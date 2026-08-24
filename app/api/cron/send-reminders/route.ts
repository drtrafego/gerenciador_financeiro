import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, invoices, contracts, systemSettings } from '@/lib/db/schema';
import type { ReminderStage } from '@/lib/db/schema';
import { eq, and, lte, inArray, notInArray } from 'drizzle-orm';
import {
  sendWhatsApp,
  resolveMessage,
  formatBRL,
  greetingName,
  buildReminderMessage,
  buildConsolidatedMessage,
  buildPostponedDueMessage,
  buildOverdueMessage,
  buildFirstBillingMessage,
  DEFAULT_TEMPLATE_BODY,
  MISSING_PHONE_ERROR,
} from '@/lib/wpp/send';
import {
  DUNNING_STAGES,
  canonicalDueDateFor,
  dueDateCandidatesFor,
  isFirstBillingFor,
  sendDateFor,
} from '@/lib/billing/schedule';
import { getConfirmedKeys } from '@/lib/billing/confirmations';

// Três regras novas que este cron passou a obedecer:
//
// 1. O passo dos vencimentos é dirigido pela DATA DE ENVIO, não pelo dia do mês.
//    dueDateCandidatesFor devolve quais vencimentos têm envio marcado para hoje,
//    então um vencimento de sábado ou domingo é avisado na segunda, com o texto
//    de "venceu no fim de semana" e a data REAL do vencimento. trigger_date
//    continua sendo a data de vencimento canônica, nunca a data de envio.
//
// 2. Cobrança de atraso em duas etapas, D+2 e D+5, e para (PASSO A2). Só cobra
//    quem comprovadamente recebeu o aviso do vencimento (linha stage 'due' com
//    status 'sent') e quem não tem pagamento confirmado em payment_confirmations.
//
// 3. Barreira anti catch-up: vencimentos anteriores a dunning_start_date
//    (gravado em system_settings na primeira execução) nunca são cobrados. Isso
//    impede que o primeiro deploy dispare cobrança retroativa de meses passados.
//    NUNCA remover essa barreira.
//
// O volume de envio pode triplicar (aviso, D+2 e D+5 no mesmo dia), por isso o
// limite de execução subiu de 60 para 300 segundos (plano Vercel Pro).
export const maxDuration = 300;

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';

function formatDateBr(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }

  // A Vercel Cron injeta "Authorization: Bearer <CRON_SECRET>" automaticamente.
  // Mantemos também o header custom "x-cron-secret" para disparos manuais.
  const authHeader = request.headers.get('authorization');
  const customSecret = request.headers.get('x-cron-secret');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = customSecret === process.env.CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!WPP_URL) {
    return NextResponse.json({ error: 'WPP_SERVICE_URL não configurado' }, { status: 500 });
  }

  // ── Datas no fuso de Brasília (UTC-3, sem horário de verão desde 2019) ──
  const nowUtc = new Date();
  const brt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const todayBrt = brt.toISOString().split('T')[0]!; // YYYY-MM-DD
  const currentTime = `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`;

  // Template padrão definido no painel (ou fallback embutido)
  const [defaultTpl] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.isDefault, 'true'))
    .limit(1);
  const defaultBody = defaultTpl?.body ?? DEFAULT_TEMPLATE_BODY;

  // ─────────────────────────────────────────────────────────────
  // PASSO A — Vencimentos cujo aviso sai HOJE.
  // O INSERT usa (contract_id, trigger_date, stage) como chave única, então
  // mesmo que o cron rode duas vezes no mesmo dia o cliente recebe uma única
  // mensagem por vencimento.
  // ─────────────────────────────────────────────────────────────
  const dueCandidates = dueDateCandidatesFor(todayBrt, 'due');

  let clientSent = 0;
  let clientFailed = 0;
  let dueSkippedByConfirmation = 0;
  const dueSummary: { name: string; valor: string; ok: boolean; first: boolean }[] = [];
  // Vencimentos que o cron processou hoje mas NÃO cobrou porque já constavam
  // pagos. Ficam fora de dueSummary de propósito: o contador "enviadas: X/Y" do
  // resumo do dono só pode falar de quem realmente entrou na fila de envio.
  // "key" é a chave de negócio do vencimento e serve só para o PASSO C não
  // reportar o mesmo pulo duas vezes no mesmo dia. Ela não entra no texto.
  const skippedSummary: { key: string; name: string; valor: string; dueIso: string }[] = [];

  type ContractRow = { contract: typeof contracts.$inferSelect; client: typeof clients.$inferSelect | null };

  // Uma leitura só de contratos ativos serve aos dois passos (aviso e cobrança).
  const dunningCandidatesByStage = DUNNING_STAGES.map((stage) => ({
    stage,
    candidates: dueDateCandidatesFor(todayBrt, stage),
  }));
  const precisaDeContratos =
    dueCandidates.length > 0 || dunningCandidatesByStage.some((s) => s.candidates.length > 0);

  const activeContracts: ContractRow[] = precisaDeContratos
    ? await db
        .select({ contract: contracts, client: clients })
        .from(contracts)
        .leftJoin(clients, eq(contracts.clientId, clients.id))
        .where(eq(contracts.status, 'active'))
    : [];

  // Contratos que vencem em "dueIso": dia de cobrança canônico igual à data e
  // vigência conferida contra a data do VENCIMENTO, não contra hoje.
  function contractsDueOn(dueIso: string): ContractRow[] {
    return activeContracts.filter(({ contract }) => {
      if (canonicalDueDateFor(dueIso, contract.billingDay) !== dueIso) return false;
      if (contract.startDate && contract.startDate > dueIso) return false;
      if (contract.endDate && contract.endDate < dueIso) return false;
      return true;
    });
  }

  type DueGroupItem = ContractRow & { dueIso: string };

  // Agrupa por cliente MAIS data de vencimento: dois vencimentos diferentes do
  // mesmo cliente processados no mesmo dia continuam sendo mensagens separadas,
  // cada uma com a sua data correta.
  function groupByClientAndDue(items: DueGroupItem[]): Map<string, DueGroupItem[]> {
    const grouped = new Map<string, DueGroupItem[]>();
    for (const item of items) {
      const clientId = item.contract.clientId;
      if (!clientId) {
        console.error(`[cron] contrato ${item.contract.id} sem clientId, ignorado na cobrança`);
        continue;
      }
      const key = `${clientId}|${item.dueIso}`;
      const group = grouped.get(key);
      if (group) group.push(item);
      else grouped.set(key, [item]);
    }
    return grouped;
  }

  if (dueCandidates.length > 0) {
    const dueItems: DueGroupItem[] = dueCandidates.flatMap((dueIso) =>
      contractsDueOn(dueIso).map((row) => ({ ...row, dueIso }))
    );

    // Quem já pagou adiantado não recebe o aviso do vencimento. O filtro vem
    // ANTES do agrupamento por cliente: um cliente com dois contratos no mesmo
    // vencimento, um pago e outro não, precisa receber a mensagem só do que
    // ficou em aberto e com o total certo. Uma consulta única para o lote todo,
    // nunca uma por grupo.
    const confirmados = await getConfirmedKeys(
      dueItems.map((i) => ({ contractId: i.contract.id, dueDate: i.dueIso }))
    );
    const dueItemsAEnviar = dueItems.filter((i) => !confirmados.has(`${i.contract.id}|${i.dueIso}`));
    const dueItemsPagos = dueItems.filter((i) => confirmados.has(`${i.contract.id}|${i.dueIso}`));

    // Pago não vira linha em reminders. O rastro do vencimento já está em
    // payment_confirmations, e criar uma linha aqui envenenaria a guarda dos
    // "anteriores" do firstBillingIds e poluiria a aba de lembretes.
    dueSkippedByConfirmation += dueItemsPagos.length;
    for (const { contract, client, dueIso } of dueItemsPagos) {
      skippedSummary.push({
        key: `${contract.id}|${dueIso}`,
        name: client?.name ?? 'Cliente',
        valor: formatBRL(contract.fixedAmount),
        dueIso,
      });
    }

    // Quais desses vencimentos são a PRIMEIRA parcela do contrato. Só muda o
    // texto da mensagem: a etapa continua sendo 'due' e a chave de deduplicação
    // (contract_id, trigger_date, stage) não muda, então o D+2 e o D+5 seguem
    // funcionando igual para quem não pagar a primeira.
    const firstBillingIds = new Set(
      dueItemsAEnviar
        .filter(({ contract, dueIso }) =>
          isFirstBillingFor(dueIso, contract.startDate, contract.billingDay)
        )
        .map(({ contract }) => contract.id)
    );

    // Clientes que já receberam alguma mensagem da Juliana. A apresentação dela
    // e as boas vindas só valem para quem nunca recebeu nada: um cliente de
    // meses que fecha um serviço novo com dia de cobrança diferente ficaria
    // sozinho no grupo daquele dia e seria tratado como estreante.
    const clientesJaAvisados = new Set(
      (
        await db
          .select({ clientId: reminders.clientId })
          .from(reminders)
          .where(eq(reminders.status, 'sent'))
      )
        .map((r) => r.clientId)
        .filter((id): id is string => !!id)
    );

    // Guarda: contrato que já foi cobrado num vencimento anterior nunca é
    // estreante, por mais que a conta de start_date mais billing_day diga que
    // sim. Pega o caso de alguém editar start_date ou billing_day de um contrato
    // que já roda há meses, que sem isso jogaria o contrato de volta na estreia.
    //
    // O que ela NÃO cobre, e não tem como cobrir por data: contrato de um
    // cliente antigo cadastrado no sistema agora com start_date errado (data do
    // cadastro em vez da data real de início). Esse contrato não tem histórico
    // nenhum, então parece estreante mesmo. Fechar isso exigiria um campo
    // explícito no cadastro dizendo que o cliente já era cliente antes.
    if (firstBillingIds.size > 0) {
      const anteriores = await db
        .select({ contractId: reminders.contractId, triggerDate: reminders.triggerDate })
        .from(reminders)
        .where(inArray(reminders.contractId, [...firstBillingIds]));

      for (const { contract, dueIso } of dueItemsAEnviar) {
        if (!firstBillingIds.has(contract.id)) continue;
        const temAnterior = anteriores.some(
          (a) =>
            a.contractId === contract.id &&
            a.triggerDate < dueIso &&
            // Só conta lembrete que é de fato um vencimento daquele contrato. Um
            // lembrete avulso criado à mão para uma data qualquer, com o contrato
            // vinculado, tiraria o cliente estreante da mensagem de boas vindas.
            canonicalDueDateFor(a.triggerDate, contract.billingDay) === a.triggerDate
        );
        if (temAnterior) firstBillingIds.delete(contract.id);
      }
    }

    for (const group of groupByClientAndDue(dueItemsAEnviar).values()) {
      const client = group[0]!.client;
      const dueIso = group[0]!.dueIso;
      const nomeEmpresa = client?.name ?? 'Cliente'; // resumo do dono (identifica quem é)
      const saudacao = greetingName(client?.contactName, client?.name); // mensagem ao cliente

      // Cliente sem telefone: registra falha (idempotente) e avisa no resumo do dono, por contrato
      if (!client?.phone) {
        for (const { contract } of group) {
          const valor = formatBRL(contract.fixedAmount);
          const [claimed] = await db
            .insert(reminders)
            .values({
              clientId: contract.clientId,
              contractId: contract.id,
              phone: '',
              triggerDate: dueIso,
              triggerTime: '09:30',
              stage: 'due',
              status: 'failed',
              errorMessage: MISSING_PHONE_ERROR,
            })
            .onConflictDoNothing()
            .returning({ id: reminders.id });
          if (claimed) {
            clientFailed++;
            dueSummary.push({
              name: nomeEmpresa,
              valor,
              ok: false,
              first: firstBillingIds.has(contract.id),
            });
          }
        }
        continue;
      }

      // Reivindica o grupo inteiro numa única instrução INSERT (atômica em
      // relação a outras execuções concorrentes). Um insert por contrato aqui
      // permitiria duas execuções paralelas (ex: cron automático + disparo
      // manual) intercalarem e cada uma reivindicar parte do grupo, quebrando
      // a garantia de "1 mensagem só" mesmo sem duplicar cobrança.
      const phone = client.phone; // extraído para preservar o narrowing dentro do .map
      const claimedRows = await db
        .insert(reminders)
        .values(
          group.map(({ contract }) => ({
            clientId: contract.clientId,
            contractId: contract.id,
            phone,
            templateId: defaultTpl?.id ?? null,
            triggerDate: dueIso,
            triggerTime: '09:30',
            stage: 'due' as const,
            status: 'pending' as const,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: reminders.id, contractId: reminders.contractId });

      let claimedContracts = group
        .map(({ contract }) => {
          const row = claimedRows.find((r) => r.contractId === contract.id);
          return row ? { id: row.id, contract } : null;
        })
        .filter((c): c is { id: string; contract: ContractRow['contract'] } => c !== null);

      if (claimedContracts.length === 0) continue; // já enviado neste mês (ou reivindicado por outra execução)

      // RECHECK: alguém pode ter confirmado o pagamento entre a leitura do lote
      // e agora (painel ou agente). Se confirmou, a linha reivindicada morre
      // como cancelada e nada é enviado. Vem antes do cálculo do total: mandar
      // valor somado de quem já pagou seria pior que mandar a cobrança.
      const confirmadosAgora = await getConfirmedKeys(
        claimedContracts.map((c) => ({ contractId: c.contract.id, dueDate: dueIso }))
      );
      if (confirmadosAgora.size > 0) {
        const cancelar = claimedContracts.filter((c) => confirmadosAgora.has(`${c.contract.id}|${dueIso}`));
        await db
          .update(reminders)
          .set({ status: 'cancelled', errorMessage: 'Pagamento confirmado antes do envio' })
          .where(inArray(reminders.id, cancelar.map((c) => c.id)));
        dueSkippedByConfirmation += cancelar.length;
        for (const { contract } of cancelar) {
          skippedSummary.push({
            key: `${contract.id}|${dueIso}`,
            name: nomeEmpresa,
            valor: formatBRL(contract.fixedAmount),
            dueIso,
          });
        }
        claimedContracts = claimedContracts.filter(
          (c) => !confirmadosAgora.has(`${c.contract.id}|${dueIso}`)
        );
        if (claimedContracts.length === 0) continue;
      }

      const dataBr = formatDateBr(dueIso);
      const noPrazo = sendDateFor(dueIso, 'due') === dueIso; // false quando o vencimento caiu no fim de semana

      let totalCents = 0;
      const items = claimedContracts.map(({ contract }) => {
        totalCents += Math.round(parseFloat(contract.fixedAmount ?? '0') * 100);
        return { name: (contract.name ?? '').trim() || 'Serviço', valor: formatBRL(contract.fixedAmount) };
      });
      const total = formatBRL((totalCents / 100).toFixed(2));

      // Nome dos serviços que estreiam neste vencimento. Vazio quando nenhum é
      // primeira parcela, que é o caso do mês a mês de sempre.
      const firstNames = claimedContracts
        .filter(({ contract }) => firstBillingIds.has(contract.id))
        .map(({ contract }) => (contract.name ?? '').trim() || 'Serviço');

      let message: string;
      if (firstNames.length > 0) {
        // Primeira cobrança do contrato: dá as boas vindas, avisa que o serviço
        // começa e cobra a primeira parcela. Cobre também o grupo misto (serviço
        // novo vencendo junto com contrato antigo) e o adiamento de fim de semana.
        message = buildFirstBillingMessage({
          saudacao,
          data: dataBr,
          items,
          total,
          postponed: !noPrazo,
          firstNames,
          clienteNovo: !clientesJaAvisados.has(group[0]!.contract.clientId ?? ''),
        });
      } else if (!noPrazo) {
        // Vencimento no fim de semana: o texto explica o adiamento e usa a data
        // REAL do vencimento, não a data de hoje.
        message = buildPostponedDueMessage({ saudacao, data: dataBr, items, total });
      } else if (claimedContracts.length === 1) {
        message = resolveMessage(defaultBody, {
          nome: saudacao,
          valor: items[0]!.valor,
          data: dataBr,
          dias: '0',
        });
      } else {
        message = buildConsolidatedMessage({ saudacao, data: dataBr, items, total });
      }

      const { ok, error } = await sendWhatsApp(client.phone, message);
      if (ok) clientSent += claimedContracts.length;
      else clientFailed += claimedContracts.length;
      for (const { contract } of claimedContracts) {
        dueSummary.push({
          name: nomeEmpresa,
          valor: formatBRL(contract.fixedAmount),
          ok,
          first: firstBillingIds.has(contract.id),
        });
      }

      await db
        .update(reminders)
        .set({
          customMessage: message,
          status: ok ? 'sent' : 'failed',
          sentAt: ok ? new Date() : null,
          errorMessage: ok ? null : error,
        })
        .where(inArray(reminders.id, claimedContracts.map((c) => c.id)));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PASSO A2 — Cobrança de atraso (D+2 e D+5), duas mensagens e para.
  // ─────────────────────────────────────────────────────────────
  let overdueSent = 0;
  let overdueFailed = 0;
  let overdueSkippedByConfirmation = 0;
  const overdueSummary: { name: string; valor: string; stage: ReminderStage; dueIso: string; ok: boolean }[] = [];

  // Data em que a cobrança automática entrou no ar. Vencimento anterior a ela
  // NUNCA é cobrado: barreira anti catch-up retroativo no primeiro deploy.
  const [dunningRow] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'dunning_start_date'))
    .limit(1);

  let dunningStartDate = dunningRow?.value ?? null;
  if (!dunningStartDate) {
    await db
      .insert(systemSettings)
      .values({ key: 'dunning_start_date', value: todayBrt })
      .onConflictDoNothing();
    const [criado] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'dunning_start_date'))
      .limit(1);
    dunningStartDate = criado?.value ?? todayBrt;
  }

  for (const { stage, candidates } of dunningCandidatesByStage) {
    const dueDates = candidates.filter((dueIso) => dueIso >= dunningStartDate!);
    if (dueDates.length === 0) continue;

    const stageItems: DueGroupItem[] = dueDates.flatMap((dueIso) =>
      contractsDueOn(dueIso).map((row) => ({ ...row, dueIso }))
    );
    if (stageItems.length === 0) continue;

    // Só cobra quem comprovadamente recebeu o aviso do vencimento.
    const avisados = await db
      .select({ contractId: reminders.contractId, triggerDate: reminders.triggerDate })
      .from(reminders)
      .where(
        and(
          inArray(reminders.contractId, [...new Set(stageItems.map((i) => i.contract.id))]),
          inArray(reminders.triggerDate, dueDates),
          eq(reminders.stage, 'due'),
          eq(reminders.status, 'sent')
        )
      );
    const avisadosSet = new Set(avisados.map((a) => `${a.contractId}|${a.triggerDate}`));

    const comAviso = stageItems.filter((i) => avisadosSet.has(`${i.contract.id}|${i.dueIso}`));
    if (comAviso.length === 0) continue;

    // E quem não tem pagamento confirmado naquele vencimento.
    const confirmados = await getConfirmedKeys(
      comAviso.map((i) => ({ contractId: i.contract.id, dueDate: i.dueIso }))
    );
    const aCobrar = comAviso.filter((i) => !confirmados.has(`${i.contract.id}|${i.dueIso}`));
    overdueSkippedByConfirmation += comAviso.length - aCobrar.length;
    if (aCobrar.length === 0) continue;

    for (const group of groupByClientAndDue(aCobrar).values()) {
      const client = group[0]!.client;
      const dueIso = group[0]!.dueIso;
      const nomeEmpresa = client?.name ?? 'Cliente';
      const saudacao = greetingName(client?.contactName, client?.name);

      const claimedRows = await db
        .insert(reminders)
        .values(
          group.map(({ contract }) => ({
            clientId: contract.clientId,
            contractId: contract.id,
            phone: client?.phone ?? '',
            triggerDate: dueIso,
            triggerTime: '09:30',
            stage,
            status: 'pending' as const,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: reminders.id, contractId: reminders.contractId });

      let claimed = group
        .map(({ contract }) => {
          const row = claimedRows.find((r) => r.contractId === contract.id);
          return row ? { id: row.id, contract } : null;
        })
        .filter((c): c is { id: string; contract: ContractRow['contract'] } => c !== null);

      if (claimed.length === 0) continue; // já cobrado (ou reivindicado por outra execução)

      // RECHECK: alguém pode ter confirmado o pagamento entre a leitura acima e
      // agora (painel ou agente). Se confirmou, a linha reivindicada morre como
      // cancelada e nada é enviado.
      const confirmadosAgora = await getConfirmedKeys(
        claimed.map((c) => ({ contractId: c.contract.id, dueDate: dueIso }))
      );
      if (confirmadosAgora.size > 0) {
        const cancelar = claimed.filter((c) => confirmadosAgora.has(`${c.contract.id}|${dueIso}`));
        await db
          .update(reminders)
          .set({ status: 'cancelled', errorMessage: 'Pagamento confirmado antes do envio' })
          .where(inArray(reminders.id, cancelar.map((c) => c.id)));
        overdueSkippedByConfirmation += cancelar.length;
        claimed = claimed.filter((c) => !confirmadosAgora.has(`${c.contract.id}|${dueIso}`));
        if (claimed.length === 0) continue;
      }

      // Telefone apagado depois do aviso: registra a falha e segue.
      if (!client?.phone) {
        await db
          .update(reminders)
          .set({ status: 'failed', errorMessage: MISSING_PHONE_ERROR })
          .where(inArray(reminders.id, claimed.map((c) => c.id)));
        overdueFailed += claimed.length;
        for (const { contract } of claimed) {
          overdueSummary.push({
            name: nomeEmpresa,
            valor: formatBRL(contract.fixedAmount),
            stage,
            dueIso,
            ok: false,
          });
        }
        continue;
      }

      let totalCents = 0;
      const items = claimed.map(({ contract }) => {
        totalCents += Math.round(parseFloat(contract.fixedAmount ?? '0') * 100);
        return { name: (contract.name ?? '').trim() || 'Serviço', valor: formatBRL(contract.fixedAmount) };
      });

      const message = buildOverdueMessage({
        saudacao,
        data: formatDateBr(dueIso),
        items,
        total: formatBRL((totalCents / 100).toFixed(2)),
        stage,
      });

      const { ok, error } = await sendWhatsApp(client.phone, message);
      if (ok) overdueSent += claimed.length;
      else overdueFailed += claimed.length;
      for (const { contract } of claimed) {
        overdueSummary.push({
          name: nomeEmpresa,
          valor: formatBRL(contract.fixedAmount),
          stage,
          dueIso,
          ok,
        });
      }

      await db
        .update(reminders)
        .set({
          customMessage: message,
          status: ok ? 'sent' : 'failed',
          sentAt: ok ? new Date() : null,
          errorMessage: ok ? null : error,
        })
        .where(inArray(reminders.id, claimed.map((c) => c.id)));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PASSO B — Lembretes avulsos criados manualmente no painel
  // As linhas de cobrança de atraso ficam de fora: elas têm data de envio
  // própria (calculada no PASSO A2) e seriam varridas fora de hora aqui, já que
  // o trigger_date delas é a data do vencimento, sempre no passado.
  // ─────────────────────────────────────────────────────────────
  const pendingRows = await db
    .select({
      reminder: reminders,
      template: messageTemplates,
      client: clients,
      invoice: invoices,
      contract: contracts,
    })
    .from(reminders)
    .leftJoin(messageTemplates, eq(reminders.templateId, messageTemplates.id))
    .leftJoin(clients, eq(reminders.clientId, clients.id))
    .leftJoin(invoices, eq(reminders.invoiceId, invoices.id))
    .leftJoin(contracts, eq(reminders.contractId, contracts.id))
    .where(
      and(
        eq(reminders.status, 'pending'),
        lte(reminders.triggerDate, todayBrt),
        notInArray(reminders.stage, ['overdue_d2', 'overdue_d5'])
      )
    );

  const toSend = pendingRows.filter((r) => {
    const reminderTime = r.reminder.triggerTime ?? '08:00';
    return r.reminder.triggerDate < todayBrt || reminderTime <= currentTime;
  });

  let sent = 0;
  let failed = 0;

  for (const row of toSend) {
    const { reminder, template, client, invoice, contract } = row;

    const message = buildReminderMessage({ reminder, template, client, invoice, contract, now: nowUtc });

    if (!message) continue;

    const { ok, error } = await sendWhatsApp(reminder.phone, message);

    if (ok) {
      sent++;
      if (reminder.recurring) {
        const current = new Date(reminder.triggerDate + 'T12:00:00');
        current.setMonth(current.getMonth() + 1);
        const nextDate = current.toISOString().split('T')[0]!;
        const isExpired = reminder.endDate && nextDate > reminder.endDate;
        await db.update(reminders).set({
          triggerDate: nextDate,
          sentAt: new Date(),
          status: isExpired ? 'completed' : 'pending',
          errorMessage: null,
        }).where(eq(reminders.id, reminder.id));
      } else {
        await db.update(reminders).set({
          status: 'sent',
          sentAt: new Date(),
          errorMessage: null,
        }).where(eq(reminders.id, reminder.id));
      }
    } else {
      failed++;
      await db.update(reminders).set({
        status: 'failed',
        errorMessage: error,
      }).where(eq(reminders.id, reminder.id));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PASSO C — Aviso para o dono (resumo do que saiu hoje)
  // ─────────────────────────────────────────────────────────────
  const [alertRow] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'alert_phone'))
    .limit(1);
  const alertPhone = alertRow?.value;

  // Quais pulos deste dia já foram reportados ao dono. Necessário porque quem
  // pagou adiantado não gera linha em reminders, então o bloco dos pulados não
  // tem a idempotência estrutural que o onConflictDoNothing dá aos outros dois:
  // sem isso, o disparo manual depois do cron das 9h30 repete o aviso.
  //
  // Uma chave só, com a data embutida. Se a data guardada não é a de hoje, o
  // conteúdo antigo é ignorado e sobrescrito, então a chave se limpa sozinha e
  // não vira log append only dentro de uma tabela de configuração.
  function parseSkipsReportados(value: string | undefined): Set<string> {
    if (!value) return new Set();
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') return new Set();
      const { date, keys } = parsed as { date?: unknown; keys?: unknown };
      if (date !== todayBrt || !Array.isArray(keys)) return new Set();
      return new Set(keys.filter((k): k is string => typeof k === 'string'));
    } catch (e) {
      // Valor corrompido não pode derrubar o cron que cobra cliente real: no
      // pior caso o dono recebe o aviso repetido, que é ruído, não prejuízo.
      console.error('[cron] owner_notified_skips ilegível, tratando como vazio', e);
      return new Set();
    }
  }

  const [skipsRow] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'owner_notified_skips'))
    .limit(1);
  const reportadas = parseSkipsReportados(skipsRow?.value);

  // Pulos ainda não reportados, com dedup interna por chave: o mesmo vencimento
  // pode entrar pelo filtro em lote e pelo recheck numa execução esquisita.
  const skippedNovos: typeof skippedSummary = [];
  const vistos = new Set<string>();
  for (const s of skippedSummary) {
    if (reportadas.has(s.key) || vistos.has(s.key)) continue;
    vistos.add(s.key);
    skippedNovos.push(s);
  }
  const dueSkipsAlreadyReported = skippedSummary.length - skippedNovos.length;

  let ownerNotified = false;
  // skippedNovos entra na condição: no dia em que todo mundo pagou adiantado
  // não sai mensagem nenhuma, e o silêncio faria o dono achar que o cron quebrou.
  if (alertPhone && (dueSummary.length > 0 || skippedNovos.length > 0 || overdueSummary.length > 0)) {
    const blocos: string[] = [];

    if (dueSummary.length > 0) {
      const linhas = dueSummary
        .map(
          (d) =>
            `• ${d.name}: ${d.valor}${d.first ? ' (primeira cobrança, contrato novo)' : ''}${d.ok ? '' : ' (FALHA no envio)'}`
        )
        .join('\n');
      blocos.push(
        `📅 Vencimentos processados hoje (${formatDateBr(todayBrt)}):\n${linhas}\n\n` +
          `Mensagens enviadas aos clientes: ${clientSent}/${dueSummary.length}.`
      );
    }

    if (skippedNovos.length > 0) {
      const linhas = skippedNovos
        .map((d) => `• ${d.name}: ${d.valor} (vencimento ${formatDateBr(d.dueIso).slice(0, 5)})`)
        .join('\n');
      blocos.push(
        `✅ Não cobrei hoje, pagamento já confirmado:\n${linhas}\n\n` +
          `Esses clientes tinham vencimento processado hoje e já constavam como pagos. Nenhuma mensagem foi enviada, está tudo certo.`
      );
    }

    if (overdueSummary.length > 0) {
      const linhas = overdueSummary
        .map(
          (d) =>
            `• ${d.name}: ${d.valor} (${d.stage === 'overdue_d2' ? 'D+2' : 'D+5'}, venceu em ${formatDateBr(d.dueIso).slice(0, 5)})${d.ok ? '' : ' (FALHA no envio)'}`
        )
        .join('\n');
      blocos.push(
        `⏰ Cobranças de atraso enviadas hoje:\n${linhas}\n\n` +
          `Cobranças enviadas: ${overdueSent}/${overdueSummary.length}.`
      );
    }

    // Guarda contra mensagem vazia: hoje a condição de entrada já impede isso,
    // mas se alguém mexer nas listas no futuro o dono receberia um texto em
    // branco no WhatsApp, bug que ninguém revisa duas vezes.
    if (blocos.length > 0) {
      ownerNotified = (await sendWhatsApp(alertPhone, blocos.join('\n\n'))).ok;

      // Só marca como reportado DEPOIS do envio confirmado. As falhas não são
      // simétricas: marcar antes e o envio falhar faz o dono nunca saber que
      // aquele cliente não foi cobrado, perda de informação em sistema
      // financeiro. Marcar depois e o processo morrer no meio faz o dono receber
      // duas vezes, que é só ruído. Erramos de propósito para o lado benigno.
      //
      // A releitura mais união preserva o que outra execução gravou entre a
      // primeira leitura e agora. Duas execuções REALMENTE simultâneas ainda
      // podem se sobrepor e repetir o aviso, e isso fica descoberto DE
      // PROPÓSITO: o dano máximo é uma mensagem duplicada ao dono, e blindar
      // com lock ou transação compraria risco de concorrência maior do que o
      // problema que resolve.
      if (ownerNotified && skippedNovos.length > 0) {
        const [atual] = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, 'owner_notified_skips'))
          .limit(1);
        const uniao = new Set([
          ...parseSkipsReportados(atual?.value),
          ...skippedNovos.map((s) => s.key),
        ]);
        const value = JSON.stringify({ date: todayBrt, keys: [...uniao] });
        await db
          .insert(systemSettings)
          .values({ key: 'owner_notified_skips', value })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    contractsProcessed: dueSummary.length,
    clientSent,
    clientFailed,
    dueSkippedByConfirmation,
    dueSkipsAlreadyReported,
    ownerNotified,
    avulsosSent: sent,
    avulsosFailed: failed,
    overdueSent,
    overdueFailed,
    overdueSkippedByConfirmation,
    dunningStartDate,
  });
}

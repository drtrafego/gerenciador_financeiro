import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, invoices, contracts, systemSettings } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { sendWhatsApp, resolveMessage, formatBRL, greetingName, buildReminderMessage, DEFAULT_TEMPLATE_BODY } from '@/lib/wpp/send';

export const maxDuration = 60;

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';

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
  const year = brt.getUTCFullYear();
  const monthIdx = brt.getUTCMonth(); // 0-11
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dayOfMonth = brt.getUTCDate();
  const todayBrt = brt.toISOString().split('T')[0]!; // YYYY-MM-DD
  const lastDayOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const currentTime = `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`;

  // Template padrão definido no painel (ou fallback embutido)
  const [defaultTpl] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.isDefault, 'true'))
    .limit(1);
  const defaultBody = defaultTpl?.body ?? DEFAULT_TEMPLATE_BODY;

  // ─────────────────────────────────────────────────────────────
  // PASSO A — Contratos ativos que vencem HOJE (dia fixo do mês).
  // Dispara somente no dia exato do vencimento. O INSERT usa a data de
  // vencimento canônica do mês como chave única, então mesmo que o cron
  // rode duas vezes no mesmo dia, o cliente recebe uma única mensagem.
  // ─────────────────────────────────────────────────────────────
  const activeContracts = await db
    .select({ contract: contracts, client: clients })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(eq(contracts.status, 'active'));

  const dueThisMonth = activeContracts.filter(({ contract }) => {
    const bd = contract.billingDay ?? 5;
    const effectiveDay = Math.min(bd, lastDayOfMonth); // billingDay 31 em fev -> último dia
    if (dayOfMonth !== effectiveDay) return false; // avisa somente no dia exato do vencimento
    if (contract.startDate && contract.startDate > todayBrt) return false; // contrato futuro
    if (contract.endDate && contract.endDate < todayBrt) return false; // contrato encerrado
    return true;
  });

  let clientSent = 0;
  let clientFailed = 0;
  const dueSummary: { name: string; valor: string; ok: boolean }[] = [];

  for (const { contract, client } of dueThisMonth) {
    const bd = contract.billingDay ?? 5;
    const effectiveDay = Math.min(bd, lastDayOfMonth);
    // data de vencimento canônica do mês — mesma chave o mês inteiro (dedupe + catch-up)
    const dueDate = `${year}-${mm}-${String(effectiveDay).padStart(2, '0')}`;
    const valor = formatBRL(contract.fixedAmount);
    const nomeEmpresa = client?.name ?? 'Cliente'; // resumo do dono (identifica quem é)
    const saudacao = greetingName(client?.contactName, client?.name); // mensagem ao cliente

    // Cliente sem telefone: registra falha (idempotente) e avisa no resumo do dono
    if (!client?.phone) {
      const [claimed] = await db
        .insert(reminders)
        .values({
          clientId: contract.clientId,
          contractId: contract.id,
          phone: '',
          triggerDate: dueDate,
          triggerTime: '09:30',
          status: 'failed',
          errorMessage: 'Cliente sem telefone cadastrado',
        })
        .onConflictDoNothing()
        .returning({ id: reminders.id });
      if (claimed) {
        clientFailed++;
        dueSummary.push({ name: nomeEmpresa, valor, ok: false });
      }
      continue;
    }

    // Reivindica o envio de forma atômica: só um processo consegue inserir
    // a linha (contract_id + trigger_date é único). Evita cobrança duplicada.
    const [claimed] = await db
      .insert(reminders)
      .values({
        clientId: contract.clientId,
        contractId: contract.id,
        phone: client.phone,
        templateId: defaultTpl?.id ?? null,
        triggerDate: dueDate,
        triggerTime: '09:30',
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: reminders.id });

    if (!claimed) continue; // já enviado neste mês (ou reivindicado por outra execução)

    const message = resolveMessage(defaultBody, {
      nome: saudacao,
      valor,
      data: `${String(effectiveDay).padStart(2, '0')}/${mm}/${year}`,
      dias: '0',
    });
    const { ok, error } = await sendWhatsApp(client.phone, message);
    if (ok) clientSent++;
    else clientFailed++;
    dueSummary.push({ name: nomeEmpresa, valor, ok });

    await db
      .update(reminders)
      .set({
        customMessage: message,
        status: ok ? 'sent' : 'failed',
        sentAt: ok ? new Date() : null,
        errorMessage: ok ? null : error,
      })
      .where(eq(reminders.id, claimed.id));
  }

  // ─────────────────────────────────────────────────────────────
  // PASSO B — Lembretes avulsos criados manualmente no painel
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
    .where(and(eq(reminders.status, 'pending'), lte(reminders.triggerDate, todayBrt)));

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
  // PASSO C — Aviso para o dono (resumo dos vencimentos do dia)
  // ─────────────────────────────────────────────────────────────
  const [alertRow] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'alert_phone'))
    .limit(1);
  const alertPhone = alertRow?.value;

  let ownerNotified = false;
  if (alertPhone && dueSummary.length > 0) {
    const linhas = dueSummary
      .map((d) => `• ${d.name}: ${d.valor}${d.ok ? '' : ' (FALHA no envio)'}`)
      .join('\n');
    const ownerMsg =
      `📅 Vencimentos processados hoje (${String(dayOfMonth).padStart(2, '0')}/${mm}/${year}):\n${linhas}\n\n` +
      `Mensagens enviadas aos clientes: ${clientSent}/${dueSummary.length}.`;
    ownerNotified = (await sendWhatsApp(alertPhone, ownerMsg)).ok;
  }

  return NextResponse.json({
    ok: true,
    contractsProcessed: dueSummary.length,
    clientSent,
    clientFailed,
    ownerNotified,
    avulsosSent: sent,
    avulsosFailed: failed,
  });
}

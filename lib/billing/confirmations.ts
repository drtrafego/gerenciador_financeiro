// Confirmação de pagamento e leitura do ciclo de cobrança de um vencimento.
//
// Regras duras deste módulo:
// 1. Confirmar pagamento NUNCA cria transaction, NUNCA mexe em invoice e NUNCA
//    mexe em clients.status. Serve só para interromper as cobranças automáticas
//    de atraso (D+2 e D+5) daquele vencimento.
// 2. A chave de negócio é (contract_id, due_date). Confirmar duas vezes é
//    idempotente: a segunda chamada devolve a confirmação que já existia.
// 3. O estado do ciclo (avisado, cobrado, encerrado, pago) é sempre DERIVADO das
//    linhas de reminders mais a confirmação. Nada disso é persistido.

import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  clients,
  contracts,
  paymentConfirmations,
  reminders,
  type PaymentConfirmation,
} from '@/lib/db/schema';
import { DUNNING_STAGES, addDays, canonicalDueDateFor, sendDateFor } from './schedule';

// Erros de negócio próprios, para o chamador decidir o status HTTP (a API do
// agente converte em 404/400) sem este módulo depender da camada de rota.
export class BillingNotFoundError extends Error {}
export class BillingValidationError extends Error {}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar no formato YYYY-MM-DD');

const confirmSchema = z.object({
  contractId: z.string().uuid(),
  dueDate: isoDate,
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  source: z.enum(['panel', 'agent']),
  actor: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const unconfirmSchema = z.object({
  contractId: z.string().uuid(),
  dueDate: isoDate,
});

export type CycleStatus =
  | 'paid'
  | 'due_failed'
  | 'closed'
  | 'dunned_d5'
  | 'dunned_d2'
  | 'notified'
  | 'pending';

export type CycleReminderRow = {
  id: string;
  stage: string;
  status: string | null;
  triggerDate: string;
  sentAt: Date | null;
  errorMessage: string | null;
  customMessage: string | null;
};

export type OpenDueItem = {
  contractId: string;
  contractName: string | null;
  clientId: string | null;
  clientName: string | null;
  phone: string | null;
  dueDate: string;
  amount: string;
  cycleStatus: CycleStatus;
  stagesSent: string[];
  nextStage: 'overdue_d2' | 'overdue_d5' | null;
  nextSendDate: string | null;
  confirmed: boolean;
  confirmedAt: Date | null;
  confirmedBy: string | null;
};

// Data de hoje no fuso de Brasília (UTC-3, sem horário de verão desde 2019),
// mesmo cálculo usado pelo cron.
function todayBrtIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]!;
}

function keyOf(contractId: string, dueDate: string): string {
  return `${contractId}|${dueDate}`;
}

// Estado do ciclo daquele vencimento, derivado das linhas de reminders e da
// confirmação de pagamento. Função pura, sem banco: dá para testar direto.
export function deriveCycleStatus(
  rows: Pick<CycleReminderRow, 'stage' | 'status' | 'triggerDate'>[],
  confirmation: { id: string } | null,
  todayIso: string
): CycleStatus {
  if (confirmation) return 'paid';
  if (rows.length === 0) return 'pending';

  const dueIso = rows[0]!.triggerDate;
  const due = rows.find((r) => r.stage === 'due');
  const d2 = rows.find((r) => r.stage === 'overdue_d2');
  const d5 = rows.find((r) => r.stage === 'overdue_d5');
  const nadaEnviado = !rows.some((r) => r.status === 'sent');

  // Falha no aviso do vencimento é a informação mais importante do card: o
  // cliente nem soube que venceu, então ela vem antes de qualquer outro estado.
  if (due?.status === 'failed' && nadaEnviado) return 'due_failed';

  if (todayIso > sendDateFor(dueIso, 'overdue_d5')) return 'closed';
  if (d5?.status === 'sent') return 'dunned_d5';
  if (d2?.status === 'sent') return 'dunned_d2';
  if (due?.status === 'sent') return 'notified';
  return 'pending';
}

// Próxima cobrança automática daquele vencimento, se ainda houver alguma.
// Só existe próxima etapa quando o aviso do vencimento saiu de verdade: quem
// não recebeu o aviso nunca é cobrado por atraso.
export function deriveNextStep(
  rows: Pick<CycleReminderRow, 'stage' | 'status' | 'triggerDate'>[],
  confirmation: { id: string } | null,
  todayIso: string
): { nextStage: 'overdue_d2' | 'overdue_d5' | null; nextSendDate: string | null } {
  const vazio = { nextStage: null, nextSendDate: null } as const;
  if (confirmation || rows.length === 0) return vazio;

  const dueIso = rows[0]!.triggerDate;
  if (!rows.some((r) => r.stage === 'due' && r.status === 'sent')) return vazio;

  for (const stage of ['overdue_d2', 'overdue_d5'] as const) {
    const row = rows.find((r) => r.stage === stage);
    if (row) continue; // etapa já reivindicada (enviada, falha ou cancelada)
    const sendDate = sendDateFor(dueIso, stage);
    if (sendDate >= todayIso) return { nextStage: stage, nextSendDate: sendDate };
  }
  return vazio;
}

// Valida se a data informada é um vencimento legítimo do contrato.
//
// A regra principal é a data canônica calculada a partir do billingDay atual.
// Só que o billingDay é editável: se alguém trocar o dia de vencimento do
// contrato de 5 para 10, todo vencimento antigo (dia 5) deixaria de bater com o
// cálculo e o pagamento daquele mês ficaria impossível de confirmar para sempre,
// tanto pelo painel quanto pela API. Por isso o histórico também vale como
// prova: se existe linha em reminders (o aviso realmente foi disparado naquela
// data) ou uma confirmação já registrada, a data é aceita.
async function assertDueDateValida(
  contractId: string,
  dueDate: string,
  billingDay: number | null
): Promise<void> {
  const canonical = canonicalDueDateFor(dueDate, billingDay);
  if (canonical === dueDate) return;

  const [historico] = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(and(eq(reminders.contractId, contractId), eq(reminders.triggerDate, dueDate)))
    .limit(1);
  if (historico) return;

  const [confirmada] = await db
    .select({ id: paymentConfirmations.id })
    .from(paymentConfirmations)
    .where(
      and(eq(paymentConfirmations.contractId, contractId), eq(paymentConfirmations.dueDate, dueDate))
    )
    .limit(1);
  if (confirmada) return;

  throw new BillingValidationError(
    `${dueDate} não é uma data de vencimento deste contrato. O vencimento daquele mês é ${canonical}.`
  );
}

// Confirma o pagamento de um vencimento. Idempotente pela chave única
// (contract_id, due_date): chamar duas vezes devolve a mesma confirmação com
// alreadyConfirmed true. NÃO cria transaction, NÃO mexe em fatura, NÃO mexe no
// status do cliente.
export async function confirmPayment(
  input: unknown
): Promise<{ confirmation: PaymentConfirmation; alreadyConfirmed: boolean }> {
  const parsed = confirmSchema.parse(input);

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, parsed.contractId))
    .limit(1);
  if (!contract) throw new BillingNotFoundError('Contrato não encontrado');

  await assertDueDateValida(parsed.contractId, parsed.dueDate, contract.billingDay);

  const amount =
    parsed.amount === undefined || parsed.amount === null
      ? contract.fixedAmount
      : String(parsed.amount);

  const [created] = await db
    .insert(paymentConfirmations)
    .values({
      clientId: contract.clientId,
      contractId: contract.id,
      dueDate: parsed.dueDate,
      amount,
      source: parsed.source,
      actor: parsed.actor ?? null,
      note: parsed.note ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return { confirmation: created, alreadyConfirmed: false };

  const [existing] = await db
    .select()
    .from(paymentConfirmations)
    .where(
      and(
        eq(paymentConfirmations.contractId, parsed.contractId),
        eq(paymentConfirmations.dueDate, parsed.dueDate)
      )
    )
    .limit(1);
  if (!existing) throw new BillingValidationError('Não foi possível registrar a confirmação de pagamento.');
  return { confirmation: existing, alreadyConfirmed: true };
}

// Cancela as cobranças de atraso daquele vencimento que ainda não saíram e
// devolve as etapas que não serão mais enviadas: as linhas pendentes que
// acabaram de ser canceladas mais as etapas que ainda nem foram criadas e cuja
// data de envio ainda está por vir. Não mexe em linha já enviada: histórico é
// histórico.
export async function cancelPendingDunning(contractId: string, dueDate: string): Promise<string[]> {
  const todayIso = todayBrtIso();

  const rows = await db
    .select({ id: reminders.id, stage: reminders.stage, status: reminders.status })
    .from(reminders)
    .where(
      and(
        eq(reminders.contractId, contractId),
        eq(reminders.triggerDate, dueDate),
        inArray(reminders.stage, [...DUNNING_STAGES])
      )
    );

  const pendentes = rows.filter((r) => r.status === 'pending');
  if (pendentes.length > 0) {
    await db
      .update(reminders)
      .set({ status: 'cancelled', errorMessage: 'Pagamento confirmado' })
      .where(inArray(reminders.id, pendentes.map((p) => p.id)));
  }

  const jaExistem = new Set(rows.map((r) => r.stage));
  const futuras = DUNNING_STAGES.filter(
    (stage) => !jaExistem.has(stage) && sendDateFor(dueDate, stage) >= todayIso
  );

  return [...new Set([...pendentes.map((p) => p.stage), ...futuras])];
}

// Desfaz a confirmação. Idempotente: se não havia nada, devolve removed false.
// Desfazer depois que a data do D+5 já passou não reenvia nada, o ciclo daquele
// vencimento simplesmente fica encerrado e em aberto.
export async function unconfirmPayment(
  input: unknown
): Promise<{ removed: boolean; contractId: string; dueDate: string }> {
  const parsed = unconfirmSchema.parse(input);

  const removed = await db
    .delete(paymentConfirmations)
    .where(
      and(
        eq(paymentConfirmations.contractId, parsed.contractId),
        eq(paymentConfirmations.dueDate, parsed.dueDate)
      )
    )
    .returning({ id: paymentConfirmations.id });

  return { removed: removed.length > 0, contractId: parsed.contractId, dueDate: parsed.dueDate };
}

// Consulta em lote usada pelo cron: devolve o conjunto de chaves
// "contractId|dueDate" que já têm pagamento confirmado.
export async function getConfirmedKeys(
  pairs: { contractId: string; dueDate: string }[]
): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();

  const contractIds = [...new Set(pairs.map((p) => p.contractId))];
  const dueDates = [...new Set(pairs.map((p) => p.dueDate))];

  const rows = await db
    .select({
      contractId: paymentConfirmations.contractId,
      dueDate: paymentConfirmations.dueDate,
    })
    .from(paymentConfirmations)
    .where(
      and(
        inArray(paymentConfirmations.contractId, contractIds),
        inArray(paymentConfirmations.dueDate, dueDates)
      )
    );

  const wanted = new Set(pairs.map((p) => keyOf(p.contractId, p.dueDate)));
  const found = new Set<string>();
  for (const row of rows) {
    const key = keyOf(row.contractId, row.dueDate);
    if (wanted.has(key)) found.add(key);
  }
  return found;
}

// Vencimentos de contratos ATIVOS na janela de dias pedida, com o estado do
// ciclo de cada um. Contrato pausado ou cancelado não aparece aqui: a cobrança
// automática dele já está interrompida.
export async function listOpenDues({
  clientId,
  phone,
  contractId,
  days = 45,
}: {
  clientId?: string;
  phone?: string;
  contractId?: string;
  days?: number;
}): Promise<OpenDueItem[]> {
  const todayIso = todayBrtIso();

  const conditions = [eq(contracts.status, 'active')];
  if (contractId) conditions.push(eq(contracts.id, contractId));
  if (clientId) conditions.push(eq(contracts.clientId, clientId));
  if (phone) conditions.push(eq(clients.phone, phone));

  const contractRows = await db
    .select({ contract: contracts, client: clients })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(and(...conditions));

  // Datas de vencimento canônicas de cada contrato dentro da janela.
  const planned: { contract: (typeof contractRows)[number]['contract']; client: (typeof contractRows)[number]['client']; dueDate: string }[] = [];
  for (const row of contractRows) {
    for (let offset = 0; offset <= days; offset++) {
      const dueIso = addDays(todayIso, -offset);
      if (canonicalDueDateFor(dueIso, row.contract.billingDay) !== dueIso) continue;
      if (row.contract.startDate && row.contract.startDate > dueIso) continue;
      if (row.contract.endDate && row.contract.endDate < dueIso) continue;
      planned.push({ contract: row.contract, client: row.client, dueDate: dueIso });
    }
  }

  if (planned.length === 0) return [];

  const contractIds = [...new Set(planned.map((p) => p.contract.id))];
  const dueDates = [...new Set(planned.map((p) => p.dueDate))];

  const [reminderRows, confirmationRows] = await Promise.all([
    db
      .select()
      .from(reminders)
      .where(and(inArray(reminders.contractId, contractIds), inArray(reminders.triggerDate, dueDates))),
    db
      .select()
      .from(paymentConfirmations)
      .where(
        and(
          inArray(paymentConfirmations.contractId, contractIds),
          inArray(paymentConfirmations.dueDate, dueDates)
        )
      ),
  ]);

  const remindersByKey = new Map<string, CycleReminderRow[]>();
  for (const r of reminderRows) {
    if (!r.contractId) continue;
    const key = keyOf(r.contractId, r.triggerDate);
    const row: CycleReminderRow = {
      id: r.id,
      stage: r.stage,
      status: r.status,
      triggerDate: r.triggerDate,
      sentAt: r.sentAt,
      errorMessage: r.errorMessage,
      customMessage: r.customMessage,
    };
    const list = remindersByKey.get(key);
    if (list) list.push(row);
    else remindersByKey.set(key, [row]);
  }

  const confirmationByKey = new Map<string, PaymentConfirmation>();
  for (const c of confirmationRows) confirmationByKey.set(keyOf(c.contractId, c.dueDate), c);

  return planned
    .map(({ contract, client, dueDate }) => {
      const key = keyOf(contract.id, dueDate);
      const rows = remindersByKey.get(key) ?? [];
      const confirmation = confirmationByKey.get(key) ?? null;
      const { nextStage, nextSendDate } = deriveNextStep(rows, confirmation, todayIso);
      return {
        contractId: contract.id,
        contractName: contract.name,
        clientId: contract.clientId,
        clientName: client?.name ?? null,
        phone: client?.phone ?? null,
        dueDate,
        amount: contract.fixedAmount,
        cycleStatus: deriveCycleStatus(rows, confirmation, todayIso),
        stagesSent: rows.filter((r) => r.status === 'sent').map((r) => r.stage),
        nextStage,
        nextSendDate,
        confirmed: confirmation !== null,
        confirmedAt: confirmation?.confirmedAt ?? null,
        confirmedBy: confirmation?.actor ?? null,
      } satisfies OpenDueItem;
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0));
}

// Ciclo completo de um vencimento: o item do open-dues mais as linhas cruas de
// reminders daquele ciclo (mensagem enviada, erro e horário do envio).
export async function getBillingCycle(
  contractId: string,
  dueDate: string
): Promise<{ item: OpenDueItem; reminders: CycleReminderRow[]; confirmation: PaymentConfirmation | null }> {
  const todayIso = todayBrtIso();

  const [contractRow] = await db
    .select({ contract: contracts, client: clients })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(eq(contracts.id, contractId))
    .limit(1);
  if (!contractRow) throw new BillingNotFoundError('Contrato não encontrado');

  await assertDueDateValida(contractId, dueDate, contractRow.contract.billingDay);

  const [reminderRows, [confirmation]] = await Promise.all([
    db
      .select()
      .from(reminders)
      .where(and(eq(reminders.contractId, contractId), eq(reminders.triggerDate, dueDate))),
    db
      .select()
      .from(paymentConfirmations)
      .where(
        and(eq(paymentConfirmations.contractId, contractId), eq(paymentConfirmations.dueDate, dueDate))
      )
      .limit(1),
  ]);

  const rows: CycleReminderRow[] = reminderRows.map((r) => ({
    id: r.id,
    stage: r.stage,
    status: r.status,
    triggerDate: r.triggerDate,
    sentAt: r.sentAt,
    errorMessage: r.errorMessage,
    customMessage: r.customMessage,
  }));

  const conf = confirmation ?? null;
  const { nextStage, nextSendDate } = deriveNextStep(rows, conf, todayIso);

  const item: OpenDueItem = {
    contractId: contractRow.contract.id,
    contractName: contractRow.contract.name,
    clientId: contractRow.contract.clientId,
    clientName: contractRow.client?.name ?? null,
    phone: contractRow.client?.phone ?? null,
    dueDate,
    amount: contractRow.contract.fixedAmount,
    cycleStatus: deriveCycleStatus(rows, conf, todayIso),
    stagesSent: rows.filter((r) => r.status === 'sent').map((r) => r.stage),
    nextStage,
    nextSendDate,
    confirmed: conf !== null,
    confirmedAt: conf?.confirmedAt ?? null,
    confirmedBy: conf?.actor ?? null,
  };

  return { item, reminders: rows, confirmation: conf };
}

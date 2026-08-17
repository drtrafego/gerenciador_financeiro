import { desc, and, eq, isNull, gte, lte, lt, or, sql, asc, getTableColumns } from 'drizzle-orm';
import { db } from './drizzle';
import {
  activityLogs,
  teamMembers,
  teams,
  users,
  clients,
  contracts,
  invoices,
  transactions,
  exchangeRates,
  systemSettings,
  recurringExpenses,
  reminders,
  messageTemplates,
  paymentConfirmations,
  type NewClient,
  type NewContract,
  type NewInvoice,
  type NewTransaction,
  type NewRecurringExpense,
  type NewReminder,
  type NewMessageTemplate,
} from './schema';
import { stackServerApp } from '@/stack/server';
import type { User } from './schema';
import { notTestClient } from './filters';
import { isContractEarning } from '@/lib/contracts';
import { convertAmount, safeRates } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { CLIENT_SOURCES, NONE_LABEL, NONE_COLOR, sourceLabel } from '@/lib/clientSources';
import { deriveCycleStatus, deriveNextStep } from '@/lib/billing/confirmations';

// ─── AUTH ─────────────────────────────────────
// A autenticação real do app é o Stack Auth (vide app/(dashboard)/layout.tsx).
// O cookie 'session' do template legado não é renovado pelo Stack Auth e a
// tabela 'users' legada está vazia, então a checagem antiga sempre falhava
// ("Unauthenticated"). Aqui validamos a sessão pelo Stack Auth e, por
// compatibilidade com o tipo legado, devolvemos o registro do banco quando
// existir ou um usuário virtual mínimo só para o gate de autenticação.
export async function getUser(): Promise<User | null> {
  const stackUser = await stackServerApp.getUser();
  if (!stackUser) return null;

  const email = stackUser.primaryEmail ?? '';
  if (email) {
    const [dbUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (dbUser) return dbUser;
  }

  const now = new Date();
  return {
    id: 0,
    name: stackUser.displayName ?? null,
    email,
    passwordHash: '',
    role: 'member',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);
  return result[0] ?? null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({ ...subscriptionData, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({ user: users, teamId: teamMembers.teamId })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);
  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) throw new Error('User not authenticated');

  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) return null;

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: { user: { columns: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });
  return result?.team ?? null;
}

// ─── COTAÇÕES ────────────────────────────────

export async function getLatestExchangeRate() {
  const [rate] = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1);
  return rate ?? null;
}

export async function getExchangeRateHistory(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return db
    .select()
    .from(exchangeRates)
    .where(gte(exchangeRates.fetchedAt, since))
    .orderBy(desc(exchangeRates.fetchedAt));
}

// ─── CONFIGURAÇÕES ────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ─── CLIENTES ────────────────────────────────

export async function getClients() {
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return client ?? null;
}

export async function createClient(data: NewClient) {
  const [client] = await db.insert(clients).values(data).returning();
  return client;
}

export async function updateClient(id: string, data: Partial<NewClient>) {
  const [client] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return client;
}

export async function deleteClient(id: string) {
  await db.delete(clients).where(eq(clients.id, id));
}

export async function getClientWithDetails(id: string) {
  const client = await getClientById(id);
  if (!client) return null;
  const [clientContracts, clientInvoices, clientTransactions] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.clientId, id)).orderBy(desc(contracts.createdAt)),
    db.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.createdAt)),
    db.select().from(transactions).where(eq(transactions.clientId, id)).orderBy(desc(transactions.date)),
  ]);
  return { ...client, contracts: clientContracts, invoices: clientInvoices, transactions: clientTransactions };
}

// ─── CONTRATOS ────────────────────────────────

export async function getContracts() {
  return db
    .select({ contract: contracts, clientName: clients.name })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .orderBy(desc(contracts.createdAt));
}

export async function getContractById(id: string) {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return contract ?? null;
}

export async function createContract(data: NewContract) {
  const [contract] = await db.insert(contracts).values(data).returning();
  return contract;
}

export async function updateContract(id: string, data: Partial<NewContract>) {
  const [contract] = await db
    .update(contracts)
    .set(data)
    .where(eq(contracts.id, id))
    .returning();
  return contract;
}

export async function deleteContract(id: string) {
  // Fatura é documento fiscal e nunca pode ser apagada: só perde o vínculo
  // com o contrato e continua acessível pela ficha do cliente. Lembrete não
  // é dado fiscal, pode ser removido junto com o contrato.
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ contractId: null }).where(eq(invoices.contractId, id));
    await tx.delete(reminders).where(eq(reminders.contractId, id));
    await tx.delete(contracts).where(eq(contracts.id, id));
  });
}

// ─── FATURAS ────────────────────────────────

export async function getInvoices() {
  return db
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return invoice ?? null;
}

export async function getInvoiceWithClient(id: string) {
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, id))
    .limit(1);
  return row ?? null;
}

export async function createInvoice(data: NewInvoice) {
  const [last] = await db
    .select({ num: invoices.invoiceNumber })
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  const year = new Date().getFullYear();
  let nextNum = 1;
  if (last?.num) {
    const parts = last.num.split('-');
    const lastNum = parseInt(parts[parts.length - 1] ?? '0', 10);
    nextNum = lastNum + 1;
  }
  const invoiceNumber = `INV-${year}-${String(nextNum).padStart(3, '0')}`;

  const [invoice] = await db
    .insert(invoices)
    .values({ ...data, invoiceNumber })
    .returning();
  return invoice;
}

export async function updateInvoice(id: string, data: Partial<NewInvoice>) {
  const [invoice] = await db
    .update(invoices)
    .set(data)
    .where(eq(invoices.id, id))
    .returning();
  return invoice;
}

export async function markInvoicePaid(id: string) {
  const [invoice] = await db
    .update(invoices)
    .set({ status: 'paid', paidAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return invoice;
}

export async function deleteInvoice(id: string) {
  await db.delete(invoices).where(eq(invoices.id, id));
}

// ─── TRANSAÇÕES ────────────────────────────────

export async function getTransactions(filters?: {
  from?: string;
  to?: string;
  type?: 'income' | 'expense';
}) {
  const conditions = [];
  if (filters?.from) conditions.push(gte(transactions.date, filters.from));
  if (filters?.to) conditions.push(lte(transactions.date, filters.to));
  if (filters?.type) conditions.push(eq(transactions.type, filters.type));

  return db
    .select({ transaction: transactions, clientName: clients.name, clientIsTest: clients.isTest })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date));
}

// Receitas avulsas (sem contrato) ainda não vinculadas a nenhuma fatura —
// usadas na tela "Nova Fatura" para emitir nota a partir de um lançamento.
export async function getUninvoicedIncomeTransactions() {
  return db
    .select({ transaction: transactions, clientName: clients.name })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(and(eq(transactions.type, 'income'), isNull(transactions.invoiceId)))
    .orderBy(desc(transactions.date));
}

export async function createTransaction(data: NewTransaction) {
  const [tx] = await db.insert(transactions).values(data).returning();
  return tx;
}

export async function updateTransaction(id: string, data: Partial<NewTransaction>) {
  const [tx] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
  return tx;
}

export async function deactivateRecurringTransaction(id: string) {
  const [tx] = await db
    .update(transactions)
    .set({ recurringActive: 'false' })
    .where(eq(transactions.id, id))
    .returning();
  return tx;
}

export async function deleteTransaction(id: string) {
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function getActiveRecurringTransactions(beforeDate: string, fromDate: string) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.isRecurring, 'true'),
        eq(transactions.recurringActive, 'true'),
        lte(transactions.date, beforeDate),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, fromDate))
      )
    );
}

// ─── CUSTOS RECORRENTES ────────────────────────

export async function getRecurringExpenses() {
  return db.select().from(recurringExpenses).orderBy(recurringExpenses.createdAt);
}

export async function getActiveRecurringExpenses() {
  return db.select().from(recurringExpenses).where(eq(recurringExpenses.active, 'true')).orderBy(recurringExpenses.dayOfMonth);
}

export async function createRecurringExpense(data: NewRecurringExpense) {
  const [row] = await db.insert(recurringExpenses).values(data).returning();
  return row;
}

export async function updateRecurringExpense(id: string, data: Partial<NewRecurringExpense>) {
  const [row] = await db.update(recurringExpenses).set(data).where(eq(recurringExpenses.id, id)).returning();
  return row;
}

export async function deleteRecurringExpense(id: string) {
  await db.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
}

// ─── TRANSAÇÃO ÚNICA (por id) ────────────────

export async function getTransactionById(id: string) {
  const [row] = await db
    .select({ transaction: transactions, clientName: clients.name, clientIsTest: clients.isTest })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(eq(transactions.id, id))
    .limit(1);
  return row ?? null;
}

// ─── LEMBRETES ────────────────────────────────

export async function getReminders(filters?: { status?: string }) {
  const conditions = [];
  if (filters?.status) conditions.push(eq(reminders.status, filters.status));

  return db
    .select({ reminder: reminders, clientName: clients.name })
    .from(reminders)
    .leftJoin(clients, eq(reminders.clientId, clients.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reminders.createdAt));
}

export async function getReminderById(id: string) {
  const [row] = await db
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
    .where(eq(reminders.id, id))
    .limit(1);
  return row ?? null;
}

export async function createReminder(data: NewReminder) {
  const [reminder] = await db.insert(reminders).values(data).returning();
  return reminder;
}

export async function updateReminder(id: string, data: Partial<NewReminder>) {
  const [reminder] = await db
    .update(reminders)
    .set(data)
    .where(eq(reminders.id, id))
    .returning();
  return reminder;
}

export async function cancelReminder(id: string) {
  const [reminder] = await db
    .update(reminders)
    .set({ status: 'cancelled' })
    .where(eq(reminders.id, id))
    .returning();
  return reminder;
}

export async function deleteReminder(id: string) {
  await db.delete(reminders).where(eq(reminders.id, id));
}

export async function getMessageTemplates() {
  return db.select().from(messageTemplates).orderBy(desc(messageTemplates.createdAt));
}

export async function createMessageTemplate(data: NewMessageTemplate) {
  const [template] = await db.insert(messageTemplates).values(data).returning();
  return template;
}

// ─── CICLOS DE COBRANÇA (aba Vencimentos do painel) ───
// Um ciclo é o par (contrato, data de vencimento) com todas as linhas de
// reminders daquele vencimento (aviso, D+2, D+5) e a confirmação de pagamento,
// se houver. O join com reminders é interno de propósito: lembrete avulso, sem
// contrato, não é ciclo de cobrança e não aparece aqui.
export async function getBillingCycles({ days = 60 }: { days?: number } = {}) {
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const from = new Date(brtNow.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const rows = await db
    .select({
      reminder: reminders,
      contract: contracts,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      confirmation: paymentConfirmations,
    })
    .from(reminders)
    .innerJoin(contracts, eq(reminders.contractId, contracts.id))
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .leftJoin(
      paymentConfirmations,
      and(
        eq(paymentConfirmations.contractId, contracts.id),
        eq(paymentConfirmations.dueDate, reminders.triggerDate)
      )
    )
    .where(gte(reminders.triggerDate, from))
    .orderBy(desc(reminders.triggerDate));

  // Estado do ciclo é derivado aqui no servidor (mesma função que a API do
  // agente usa), para o painel não repetir a regra do lado do cliente.
  const todayIso = brtNow.toISOString().split('T')[0]!;

  const cycles = new Map<string, {
    key: string;
    contractId: string;
    contractName: string | null;
    amount: string;
    clientId: string | null;
    clientName: string | null;
    clientPhone: string | null;
    dueDate: string;
    confirmation: {
      id: string;
      confirmedAt: Date;
      actor: string | null;
      source: string;
      note: string | null;
    } | null;
    reminders: {
      id: string;
      stage: string;
      status: string | null;
      sentAt: Date | null;
      errorMessage: string | null;
      customMessage: string | null;
    }[];
  }>();

  for (const row of rows) {
    const key = `${row.contract.id}|${row.reminder.triggerDate}`;
    let cycle = cycles.get(key);
    if (!cycle) {
      cycle = {
        key,
        contractId: row.contract.id,
        contractName: row.contract.name,
        amount: row.contract.fixedAmount,
        clientId: row.clientId,
        clientName: row.clientName,
        clientPhone: row.clientPhone,
        dueDate: row.reminder.triggerDate,
        confirmation: row.confirmation
          ? {
              id: row.confirmation.id,
              confirmedAt: row.confirmation.confirmedAt,
              actor: row.confirmation.actor,
              source: row.confirmation.source,
              note: row.confirmation.note,
            }
          : null,
        reminders: [],
      };
      cycles.set(key, cycle);
    }
    cycle.reminders.push({
      id: row.reminder.id,
      stage: row.reminder.stage,
      status: row.reminder.status,
      sentAt: row.reminder.sentAt,
      errorMessage: row.reminder.errorMessage,
      customMessage: row.reminder.customMessage,
    });
  }

  return [...cycles.values()].map((cycle) => {
    const rows = cycle.reminders.map((r) => ({
      stage: r.stage,
      status: r.status,
      triggerDate: cycle.dueDate,
    }));
    const { nextStage, nextSendDate } = deriveNextStep(rows, cycle.confirmation, todayIso);
    return {
      ...cycle,
      cycleStatus: deriveCycleStatus(rows, cycle.confirmation, todayIso),
      nextStage,
      nextSendDate,
    };
  });
}

// ─── RELATÓRIO DE INADIMPLÊNCIA ───────────────

export async function getOverdueReport() {
  const [overdueInvoices, overdueClientsRaw] = await Promise.all([
    db
      .select({ invoice: invoices, clientName: clients.name, clientPhone: clients.phone })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, 'overdue'), notTestClient))
      .orderBy(desc(invoices.dueDate)),
    db
      .select({ client: clients })
      .from(clients)
      .where(and(eq(clients.status, 'overdue'), notTestClient)),
  ]);

  const overdueClients = await Promise.all(
    overdueClientsRaw.map(async ({ client }) => {
      const activeContracts = await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.clientId, client.id), eq(contracts.status, 'active')));
      return { client, contracts: activeContracts };
    })
  );

  return { overdueInvoices, overdueClients };
}

// ─── MÉTRICAS DO DASHBOARD ────────────────────
// Fonte única usada tanto pelo dashboard humano (app/(dashboard)/dashboard/page.tsx)
// quanto pela API do agente (GET /api/agent/v1/dashboard/metrics), para os números
// nunca divergirem entre o painel e o Telegram.

export async function getDashboardData(from: string, to: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  const today = now.toISOString().split('T')[0]!;
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]!;

  // Data de início da janela de 6 meses
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    activeClients,
    overdueClients,
    latestRate,
    displayCurrencySetting,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    monthExpense,
    allContracts,
    expenseTransactions,
    sourceContracts,
    clientSourceRows,
    contractsWithSource,
    periodRealTx,
    periodRecurringPast,
    periodContracts,
    sixMonthIncomeTx,
    sixMonthRecurringPast,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(clients).where(and(eq(clients.status, 'active'), notTestClient)),
    db.select({ count: sql<number>`count(*)` }).from(clients).where(and(eq(clients.status, 'overdue'), notTestClient)),
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, 'display_currency')),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(notTestClient)
      .orderBy(desc(invoices.createdAt)).limit(5),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, 'overdue'), notTestClient)),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, 'sent'), sql`due_date BETWEEN ${today} AND ${in7days}`, notTestClient)),
    db.select({ total: sql<number>`coalesce(sum(${transactions.amount}),0)` })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(eq(transactions.type, 'expense'), gte(transactions.date, startOfMonth), notTestClient)),
    // Todos os contratos para calcular receita mensal
    db.select({
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      status: contracts.status,
      billingDay: contracts.billingDay,
    }).from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(notTestClient),
    // Transações de despesa dos últimos 6 meses (agrupamos em JS para evitar mismatch de locale)
    db.select({ amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(eq(transactions.type, 'expense'), gte(transactions.date, sixMonthsAgo.toISOString().split('T')[0]!), notTestClient)),
    // Origem do cliente: MRR (contratos ativos por canal; finalizados filtrados em JS)
    db.select({ source: clients.source, fixedAmount: contracts.fixedAmount, currency: contracts.currency, endDate: contracts.endDate })
      .from(contracts)
      .innerJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(eq(contracts.status, 'active'), notTestClient)),
    // Contagem de clientes por origem (todos os clientes cadastrados)
    db.select({ source: clients.source }).from(clients).where(notTestClient),
    // Todos os contratos com a origem do cliente, para a evolução do MRR por canal
    db.select({
      source: clients.source,
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
    }).from(contracts).leftJoin(clients, eq(contracts.clientId, clients.id)).where(notTestClient),
    // Resumo do período (bate com o fluxo de caixa): transações reais no intervalo,
    // recorrentes anteriores ainda ativas (projetadas em JS) e honorários de contrato vigentes.
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(gte(transactions.date, from), lte(transactions.date, to), notTestClient)),
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.isRecurring, 'true'),
        eq(transactions.recurringActive, 'true'),
        lt(transactions.date, from),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, from)),
        notTestClient
      )),
    db.select({ fixedAmount: contracts.fixedAmount, currency: contracts.currency, billingDay: contracts.billingDay, startDate: contracts.startDate, endDate: contracts.endDate, source: clients.source })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(
        lte(contracts.startDate, to),
        or(isNull(contracts.endDate), gte(contracts.endDate, from)),
        eq(contracts.status, 'active'),
        notTestClient
      )),
    // Gráfico de receita (últimos 6 meses): receitas avulsas reais na janela +
    // recorrentes anteriores à janela ainda ativas (mesma lógica do resumo do período acima).
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.type, 'income'),
        gte(transactions.date, sixMonthsAgo.toISOString().split('T')[0]!),
        notTestClient
      )),
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.type, 'income'),
        eq(transactions.isRecurring, 'true'),
        eq(transactions.recurringActive, 'true'),
        lt(transactions.date, sixMonthsAgo.toISOString().split('T')[0]!),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, sixMonthsAgo.toISOString().split('T')[0]!)),
        notTestClient
      )),
  ]);

  const rateRow = latestRate[0];
  const rate = safeRates(
    rateRow ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) } : null
  );
  const displayCurrency = (displayCurrencySetting[0]?.value ?? 'BRL') as Currency;

  // ── Resumo do período (mesma lógica do fluxo de caixa) ──
  const periodFromD = new Date(from + 'T12:00:00');
  const periodToD = new Date(to + 'T12:00:00');
  const periodMonths: Date[] = [];
  for (
    let d = new Date(periodFromD.getFullYear(), periodFromD.getMonth(), 1);
    d <= periodToD;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    periodMonths.push(new Date(d));
  }
  let periodIncome = 0;
  let periodExpense = 0;
  // Entradas do período agrupadas por canal de aquisição (para a Receita por Origem)
  const incomeBySource = new Map<string, number>();
  const addPeriod = (type: string, amount: string | null, currency: string | null, source?: string | null) => {
    const amt = parseFloat(amount ?? '0');
    const cur = (currency ?? 'BRL') as Currency;
    const vDisplay = convertAmount(amt, cur, displayCurrency, rate); // cards do topo
    if (type === 'income') {
      periodIncome += vDisplay;
      const vBrl = convertAmount(amt, cur, 'BRL', rate); // tabela por origem converte BRL->display
      const k = source ?? 'none';
      incomeBySource.set(k, (incomeBySource.get(k) ?? 0) + vBrl);
    } else if (type === 'expense') {
      periodExpense += vDisplay;
    }
  };
  const dayInMonth = (m: Date, billingDay: number) => {
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const day = Math.min(billingDay, lastDay);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  for (const t of periodRealTx) addPeriod(t.type, t.amount, t.currency, t.source);
  for (const t of periodRecurringPast) {
    const originalDay = new Date(t.date + 'T12:00:00').getDate();
    for (const m of periodMonths) {
      const dateStr = dayInMonth(m, originalDay);
      if (dateStr >= from && dateStr <= to && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        addPeriod(t.type, t.amount, t.currency, t.source);
      }
    }
  }
  for (const c of periodContracts) {
    for (const m of periodMonths) {
      const dateStr = dayInMonth(m, c.billingDay ?? 5);
      if (dateStr >= from && dateStr <= to && dateStr >= c.startDate && (c.endDate == null || dateStr <= c.endDate)) {
        addPeriod('income', c.fixedAmount, c.currency, c.source);
      }
    }
  }

  // MRR = soma dos contratos ativos, todos convertidos para BRL
  const activeContracts = allContracts.filter((c) => isContractEarning(c.status, c.endDate));
  const mrr = activeContracts.reduce((sum, c) => {
    const amount = parseFloat(c.fixedAmount ?? '0');
    return sum + convertAmount(amount, (c.currency ?? 'BRL') as Currency, 'BRL', rate);
  }, 0);

  // Para o histórico mês a mês (gráficos), usamos o status BRUTO do contrato
  // (não o derivado em relação a hoje): um contrato finalizado no mês passado
  // ainda deve contar nos meses em que estava vigente. `isContractEarning`
  // compara com a data de hoje, então excluiria retroativamente esses meses.
  const nonCancelledContracts = allContracts.filter((c) => c.status === 'active');

  // Agrupar despesas por "YYYY-MM" em JS (evita mismatch de locale com SQL)
  const expenseMap = new Map<string, number>();
  for (const t of expenseTransactions) {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + parseFloat(t.amount ?? '0'));
  }

  // Agrupar receitas avulsas reais por "YYYY-MM" (mesma base usada no fluxo de caixa)
  const incomeTxMap = new Map<string, number>();
  for (const t of sixMonthIncomeTx) {
    const key = t.date.slice(0, 7);
    const v = convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', rate);
    incomeTxMap.set(key, (incomeTxMap.get(key) ?? 0) + v);
  }

  // Gerar dados do gráfico para os últimos 6 meses — mesma lógica do resumo do
  // período e do fluxo de caixa: só contrato ATIVO no dia exato de vencimento
  // (billingDay), recorrentes projetadas e receitas avulsas reais do mês.
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStartStr = d.toISOString().split('T')[0]!;
    const monthEndStr = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]!;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    let monthIncome = 0;
    for (const c of nonCancelledContracts) {
      const dueDate = dayInMonth(d, c.billingDay ?? 5);
      if (dueDate >= monthStartStr && dueDate <= monthEndStr && dueDate >= c.startDate && (c.endDate == null || dueDate <= c.endDate)) {
        monthIncome += convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', rate);
      }
    }

    // MRR do mês: contratos vigentes naquele mês (sem depender do dia exato de
    // vencimento nem de receita avulsa) — é o "quanto estava contratado", não o caixa.
    let monthMrr = 0;
    for (const c of nonCancelledContracts) {
      const cStart = c.startDate;
      const cEnd = c.endDate;
      if (cStart <= monthEndStr && (cEnd == null || cEnd >= monthStartStr)) {
        monthMrr += convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', rate);
      }
    }

    for (const t of sixMonthRecurringPast) {
      const originalDay = new Date(t.date + 'T12:00:00').getDate();
      const dateStr = dayInMonth(d, originalDay);
      if (dateStr >= monthStartStr && dateStr <= monthEndStr && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        monthIncome += convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', rate);
      }
    }
    monthIncome += incomeTxMap.get(key) ?? 0;

    chartData.push({
      month: label,
      income: monthIncome,
      expense: expenseMap.get(key) ?? 0,
      mrr: monthMrr,
    });
  }

  // ─── Receita por origem (canal de aquisição) ───
  // Códigos na ordem fixa de exibição; "none" = cliente sem origem definida.
  const SOURCE_ORDER = ['referral', 'organic', 'meta', 'google'];
  const sourceAgg = new Map<string, { mrr: number; total: number; clients: number }>();
  const ensureSource = (key: string) => {
    let entry = sourceAgg.get(key);
    if (!entry) {
      entry = { mrr: 0, total: 0, clients: 0 };
      sourceAgg.set(key, entry);
    }
    return entry;
  };

  for (const r of sourceContracts) {
    if (!isContractEarning('active', r.endDate)) continue; // pula contratos finalizados
    const key = r.source ?? 'none';
    ensureSource(key).mrr += convertAmount(parseFloat(r.fixedAmount ?? '0'), (r.currency ?? 'BRL') as Currency, 'BRL', rate);
  }
  // "total" = entradas do período por canal (contratos + avulsos), já no displayCurrency
  for (const [src, val] of incomeBySource) {
    ensureSource(src).total += val;
  }
  for (const r of clientSourceRows) {
    ensureSource(r.source ?? 'none').clients += 1;
  }

  const sourceBreakdown = [...SOURCE_ORDER, 'none']
    .filter((key) => {
      if (key !== 'none') return true;
      const e = sourceAgg.get('none');
      return !!e && (e.mrr > 0 || e.total > 0 || e.clients > 0);
    })
    .map((key) => {
      const e = sourceAgg.get(key);
      return { code: key, mrr: e?.mrr ?? 0, total: e?.total ?? 0, clients: e?.clients ?? 0 };
    });

  // Evolução do MRR por canal nos últimos 6 meses (mesmo critério de janela do RevenueChart).
  const sourceTrendData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

    const row: Record<string, number | string> = { month: label };
    for (const s of CLIENT_SOURCES) row[s.label] = 0;
    row[NONE_LABEL] = 0;

    for (const c of contractsWithSource) {
      const start = new Date(c.startDate + 'T12:00:00');
      const end = c.endDate ? new Date(c.endDate + 'T12:00:00') : null;
      if (start <= monthEnd && (end === null || end >= monthStart)) {
        const amount = convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', rate);
        const key = sourceLabel(c.source);
        row[key] = (Number(row[key]) || 0) + amount;
      }
    }
    sourceTrendData.push(row);
  }

  // Só desenha as linhas dos canais que têm algum valor na janela.
  const activeLabels = new Set<string>();
  for (const row of sourceTrendData) {
    for (const k of Object.keys(row)) {
      if (k !== 'month' && Number(row[k]) > 0) activeLabels.add(k);
    }
  }
  const sourceSeries = [
    ...CLIENT_SOURCES.map((s) => ({ key: s.label, color: s.color })),
    { key: NONE_LABEL, color: NONE_COLOR },
  ].filter((s) => activeLabels.has(s.key));

  return {
    periodIncome,
    periodExpense,
    sourceBreakdown,
    sourceTrendData,
    sourceSeries,
    activeClients: Number(activeClients[0]?.count ?? 0),
    overdueClients: Number(overdueClients[0]?.count ?? 0),
    rate,
    displayCurrency,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    mrr,
    monthExpense: Number(monthExpense[0]?.total ?? 0),
    chartData,
  };
}

// ─── FLUXO DE CAIXA ────────────────────────────
// Fonte única usada tanto pela página humana (app/(dashboard)/cash-flow/page.tsx)
// quanto pela API do agente (GET /api/agent/v1/dashboard/cash-flow).

export async function getCashFlowData(from: string, to: string) {
  const [txData, recurringFromPast, contractData, latestRate, displayCurrencySetting, clientList] = await Promise.all([
    // Transações reais dentro do intervalo
    db
      .select(getTableColumns(transactions))
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(gte(transactions.date, from), lte(transactions.date, to), notTestClient))
      .orderBy(desc(transactions.date)),

    // Recorrentes que começaram ANTES do intervalo e seguem ativas (projetar nos meses do intervalo)
    db
      .select(getTableColumns(transactions))
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(
        and(
          eq(transactions.isRecurring, 'true'),
          eq(transactions.recurringActive, 'true'),
          lt(transactions.date, from),
          or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, from)),
          notTestClient
        )
      ),

    // Contratos cuja vigência cruza o intervalo
    db
      .select({
        id: contracts.id,
        fixedAmount: contracts.fixedAmount,
        currency: contracts.currency,
        billingDay: contracts.billingDay,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        status: contracts.status,
        description: contracts.description,
        clientName: clients.name,
      })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(
        and(
          lte(contracts.startDate, to),
          or(isNull(contracts.endDate), gte(contracts.endDate, from)),
          eq(contracts.status, 'active'),
          notTestClient
        )
      ),

    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, 'display_currency')),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);

  const rateRow = latestRate[0];
  const usdBrl = Number(rateRow?.usdBrl);
  const usdArs = Number(rateRow?.usdArs);
  const rate =
    usdBrl > 0 && usdArs > 0 ? { usd_brl: usdBrl, usd_ars: usdArs } : { usd_brl: 5.87, usd_ars: 1429 };

  // Lista de "primeiro dia de cada mês" entre from e to
  const fromD = new Date(from + 'T12:00:00');
  const toD = new Date(to + 'T12:00:00');
  const months: Date[] = [];
  for (let d = new Date(fromD.getFullYear(), fromD.getMonth(), 1); d <= toD; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push(new Date(d));
  }

  // Honorário de cada contrato em cada mês do intervalo (respeitando billingDay e vigência)
  const contractIncomes = [];
  for (const c of contractData) {
    for (const m of months) {
      const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const day = Math.min(c.billingDay ?? 5, lastDay);
      const dateStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const withinRange = dateStr >= from && dateStr <= to;
      const withinContract = dateStr >= c.startDate && (c.endDate == null || dateStr <= c.endDate);
      if (withinRange && withinContract) {
        contractIncomes.push({
          id: `contract-${c.id}-${dateStr}`,
          type: 'income' as const,
          category: 'Contrato',
          description: c.clientName ? `Honorário — ${c.clientName}` : c.description ?? 'Contrato mensal',
          amount: c.fixedAmount ?? '0',
          currency: c.currency ?? 'BRL',
          date: dateStr,
          isContract: true as const,
        });
      }
    }
  }

  // Projeção das recorrentes de meses anteriores para cada mês do intervalo
  const projectedRecurring = [];
  for (const t of recurringFromPast) {
    const originalDay = new Date(t.date + 'T12:00:00').getDate();
    for (const m of months) {
      const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const day = Math.min(originalDay, lastDay);
      const dateStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const withinRange = dateStr >= from && dateStr <= to;
      const notEnded = !t.recurringEndsAt || dateStr <= t.recurringEndsAt;
      if (withinRange && notEnded) {
        projectedRecurring.push({ ...t, date: dateStr, isProjected: true as const });
      }
    }
  }

  const allTransactions = [...txData, ...projectedRecurring];

  return {
    transactions: allTransactions,
    contractIncomes,
    rate,
    displayCurrency: (displayCurrencySetting[0]?.value ?? 'BRL') as Currency,
    clients: clientList,
  };
}

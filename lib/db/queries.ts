import { desc, and, eq, ne, isNull, inArray, gte, lte, lt, or, sql, asc, getTableColumns } from 'drizzle-orm';
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
import type { Currency, RatesMap } from '@/lib/currency/format';
import { addDaysIso, previousPeriod, todayBrt } from '@/lib/period';
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

// Antes de apagar um PDF substituído: nada impede dois contratos apontarem para
// o mesmo arquivo (pdf_url não é único e a API aceita colar qualquer link), e
// apagar o blob de um levaria o documento do outro junto, sem aviso.
export async function isPdfUrlUsedByOtherContract(pdfUrl: string, excludeId: string) {
  const [row] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.pdfUrl, pdfUrl), ne(contracts.id, excludeId)))
    .limit(1);
  return !!row;
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
  // "Hoje" no horário do Brasil. Em UTC, o dia (e no dia 31 o mês inteiro) virava
  // às 21h, e o dashboard passava a comparar períodos errados à noite.
  const today = todayBrt();
  const in7days = addDaysIso(today, 7);

  // Período anterior, para a comparação de cada indicador. Mês inteiro compara
  // com o mês inteiro anterior; qualquer outro intervalo compara com um intervalo
  // de mesma duração colado antes dele.
  const prev = previousPeriod({ from, to });

  // Data de início da janela de 6 meses
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    latestRate,
    rateHistory,
    displayCurrencySetting,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    allContracts,
    expenseTransactions,
    expenseRecurringPast,
    sourceContracts,
    clientSourceRows,
    contractsWithSource,
    periodRealTx,
    periodRecurringPast,
    periodContracts,
    periodConfirmations,
    sixMonthIncomeTx,
    sixMonthRecurringPast,
  ] = await Promise.all([
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    // Histórico de cotação: cada mês do gráfico converte pela cotação da época,
    // senão o passado inteiro muda de forma toda vez que o dólar mexe hoje.
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(500),
    db.select().from(systemSettings).where(eq(systemSettings.key, 'display_currency')),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(notTestClient)
      .orderBy(desc(invoices.createdAt)).limit(5),
    // Em atraso é DERIVADO do vencimento, não do status digitado à mão. Antes só
    // aparecia aqui a fatura que alguém tinha marcado como "overdue" no painel,
    // então uma fatura vencida há semanas continuava contando como em dia.
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(
        inArray(invoices.status, ['sent', 'overdue']),
        lt(invoices.dueDate, today),
        notTestClient
      )),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, 'sent'), sql`due_date BETWEEN ${today} AND ${in7days}`, notTestClient)),
    // Todos os contratos para calcular receita mensal
    db.select({
      clientId: contracts.clientId,
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
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(eq(transactions.type, 'expense'), gte(transactions.date, sixMonthsAgo.toISOString().split('T')[0]!), notTestClient)),
    // Despesas recorrentes anteriores à janela: sem elas, o gráfico compara
    // receita projetada com despesa só realizada e o saldo fica otimista.
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.type, 'expense'),
        eq(transactions.isRecurring, 'true'),
        eq(transactions.recurringActive, 'true'),
        lt(transactions.date, sixMonthsAgo.toISOString().split('T')[0]!),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, sixMonthsAgo.toISOString().split('T')[0]!)),
        notTestClient
      )),
    // Origem do cliente: MRR (contratos ativos por canal; finalizados filtrados em JS)
    db.select({ source: clients.source, fixedAmount: contracts.fixedAmount, currency: contracts.currency, endDate: contracts.endDate })
      .from(contracts)
      .innerJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(eq(contracts.status, 'active'), notTestClient)),
    // Contagem de clientes por origem (todos os clientes cadastrados)
    db.select({ source: clients.source }).from(clients).where(notTestClient),
    // Contratos com a origem do cliente, para a evolução do MRR por canal.
    // O filtro de status existe porque o gráfico de barras ao lado só conta
    // contrato ativo: sem ele, os dois gráficos de MRR por origem mostravam
    // populações diferentes, um contando cancelado e pausado e o outro não.
    db.select({
      source: clients.source,
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
    }).from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(eq(contracts.status, 'active'), notTestClient)),
    // Resumo do período (bate com o fluxo de caixa): transações reais no intervalo,
    // recorrentes anteriores ainda ativas (projetadas em JS) e honorários de contrato vigentes.
    //
    // A janela começa no período ANTERIOR porque os mesmos dados alimentam a
    // comparação de cada indicador. Buscar duas vezes o mesmo tipo de linha só
    // para separar os dois períodos seria o dobro de ida ao banco.
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, date: transactions.date, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(gte(transactions.date, prev.from), lte(transactions.date, to), notTestClient)),
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.isRecurring, 'true'),
        eq(transactions.recurringActive, 'true'),
        // A janela é a do período ATUAL, não a do anterior. Estreitar aqui faria
        // uma recorrente nascida no mês passado sumir do mês atual, e o mesmo mês
        // passaria a fechar com valores diferentes conforme a tela em que aparece.
        // Quem evita a contagem dupla no período anterior é o corte dentro de
        // totalsFor, que ignora a ocorrência de origem.
        lt(transactions.date, from),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, prev.from)),
        notTestClient
      )),
    db.select({ id: contracts.id, fixedAmount: contracts.fixedAmount, currency: contracts.currency, billingDay: contracts.billingDay, startDate: contracts.startDate, endDate: contracts.endDate, source: clients.source })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(
        lte(contracts.startDate, to),
        or(isNull(contracts.endDate), gte(contracts.endDate, prev.from)),
        eq(contracts.status, 'active'),
        notTestClient
      )),
    // Pagamentos confirmados: é o que separa "recebido" de "a receber" num
    // honorário de contrato, que não gera transação quando é pago.
    db.select({ contractId: paymentConfirmations.contractId, dueDate: paymentConfirmations.dueDate })
      .from(paymentConfirmations)
      .where(and(gte(paymentConfirmations.dueDate, prev.from), lte(paymentConfirmations.dueDate, to))),
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

  const dayInMonth = (m: Date, billingDay: number) => {
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const day = Math.min(billingDay, lastDay);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const confirmedKeys = new Set(periodConfirmations.map((c) => `${c.contractId}|${c.dueDate}`));

  // ── Totais de um intervalo (mesma lógica do fluxo de caixa) ──
  //
  // A diferença para a versão anterior é a separação entre RECEBIDO e A RECEBER.
  // Antes tudo virava um número só chamado "entradas", que somava honorário de
  // contrato ainda não pago: no dia 1 o card já mostrava o mês inteiro como se
  // tivesse entrado, e não fechava com o extrato do banco.
  //
  // Um honorário de contrato não gera transação quando é pago, então o que diz se
  // ele entrou é a confirmação de pagamento (a mesma que interrompe a cobrança
  // automática). Transação lançada à mão conta como recebida quando a data dela
  // já chegou, que é como o fluxo de caixa sempre tratou.
  function totalsFor(pFrom: string, pTo: string) {
    const fromD = new Date(pFrom + 'T12:00:00');
    const toD = new Date(pTo + 'T12:00:00');
    const months: Date[] = [];
    for (
      let d = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
      d <= toD;
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    ) {
      months.push(new Date(d));
    }

    let received = 0;
    let toReceive = 0;
    let expense = 0;
    const incomeBySource = new Map<string, number>();

    const addIncome = (
      amount: string | null,
      currency: string | null,
      source: string | null | undefined,
      pago: boolean
    ) => {
      const amt = parseFloat(amount ?? '0');
      const cur = (currency ?? 'BRL') as Currency;
      if (pago) received += convertAmount(amt, cur, displayCurrency, rate);
      else toReceive += convertAmount(amt, cur, displayCurrency, rate);
      // A tabela por origem soma tudo do período, pago ou não, e converte de BRL
      // para a moeda de exibição na hora de montar a linha.
      const k = source ?? 'none';
      incomeBySource.set(k, (incomeBySource.get(k) ?? 0) + convertAmount(amt, cur, 'BRL', rate));
    };

    const addExpense = (amount: string | null, currency: string | null) => {
      expense += convertAmount(parseFloat(amount ?? '0'), (currency ?? 'BRL') as Currency, displayCurrency, rate);
    };

    for (const t of periodRealTx) {
      if (t.date < pFrom || t.date > pTo) continue;
      if (t.type === 'income') addIncome(t.amount, t.currency, t.source, t.date <= today);
      else if (t.type === 'expense') addExpense(t.amount, t.currency);
    }

    for (const t of periodRecurringPast) {
      // A ocorrência de origem já entra por periodRealTx quando cai dentro deste
      // intervalo. Sem este corte, ela seria contada de novo aqui como projeção.
      if (t.date >= pFrom) continue;
      const originalDay = new Date(t.date + 'T12:00:00').getDate();
      for (const m of months) {
        const dateStr = dayInMonth(m, originalDay);
        if (dateStr < pFrom || dateStr > pTo) continue;
        if (t.recurringEndsAt && dateStr > t.recurringEndsAt) continue;
        if (t.type === 'income') addIncome(t.amount, t.currency, t.source, dateStr <= today);
        else if (t.type === 'expense') addExpense(t.amount, t.currency);
      }
    }

    for (const c of periodContracts) {
      for (const m of months) {
        const dateStr = dayInMonth(m, c.billingDay ?? 5);
        if (dateStr < pFrom || dateStr > pTo) continue;
        if (dateStr < c.startDate || (c.endDate != null && dateStr > c.endDate)) continue;
        addIncome(c.fixedAmount, c.currency, c.source, confirmedKeys.has(`${c.id}|${dateStr}`));
      }
    }

    return { received, toReceive, expense, incomeBySource };
  }

  const atual = totalsFor(from, to);
  const anterior = totalsFor(prev.from, prev.to);

  const periodReceived = atual.received;
  const periodToReceive = atual.toReceive;
  const periodExpense = atual.expense;
  // Mantido para quem lê "entradas do período" como o total previsto do intervalo
  // (a API do agente e a tabela por origem continuam usando esse número).
  const periodIncome = atual.received + atual.toReceive;
  const incomeBySource = atual.incomeBySource;

  // MRR: quanto estava contratado numa data. Uma definição só, usada pelo card,
  // pelo gráfico e pela contagem de clientes.
  //
  // Duas correções em relação à versão anterior: a data de referência é o fim do
  // período escolhido (antes era sempre hoje, então o card não fechava com o
  // último ponto do gráfico), e contrato que ainda não começou não conta (antes,
  // um contrato assinado hoje para começar em outubro já entrava no MRR de hoje).
  const contractsActiveOn = (refDate: string) =>
    allContracts.filter(
      (c) =>
        c.status === 'active' &&
        c.startDate <= refDate &&
        (c.endDate == null || c.endDate >= refDate)
    );

  const mrrOn = (refDate: string) =>
    contractsActiveOn(refDate).reduce(
      (sum, c) => sum + convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', rate),
      0
    );

  const mrrRefDate = to < today ? to : today;
  const mrr = mrrOn(mrrRefDate);
  const mrrPrev = mrrOn(prev.to);

  // Clientes que sustentam o MRR, derivado do contrato. Antes vinha de
  // clients.status, um campo digitado à mão que não tem relação nenhuma com ter
  // contrato vigente.
  const activeClientIds = new Set(
    contractsActiveOn(mrrRefDate).map((c) => c.clientId).filter((id): id is string => !!id)
  );
  const activeClients = activeClientIds.size;

  // Movimentação do período: o que entrou e o que saiu de contrato.
  const contratosNovos = allContracts.filter(
    (c) => c.status === 'active' && c.startDate >= from && c.startDate <= to
  ).length;
  const contratosEncerrados = allContracts.filter(
    (c) => c.endDate != null && c.endDate >= from && c.endDate <= to
  ).length;

  // Para o histórico mês a mês (gráficos), usamos o status BRUTO do contrato
  // (não o derivado em relação a hoje): um contrato finalizado no mês passado
  // ainda deve contar nos meses em que estava vigente. `isContractEarning`
  // compara com a data de hoje, então excluiria retroativamente esses meses.
  const nonCancelledContracts = allContracts.filter((c) => c.status === 'active');

  // Cotação da época de cada mês. Sem isso, todo o histórico era convertido pela
  // cotação de hoje e o gráfico de 6 meses mudava de forma de um dia para o
  // outro, sem nada ter acontecido no negócio.
  const rateByMonth = new Map<string, RatesMap>();
  for (const r of rateHistory) {
    const key = (r.fetchedAt ?? new Date()).toISOString().slice(0, 7);
    // A lista vem da mais recente para a mais antiga, então a primeira de cada
    // mês é a última cotação daquele mês.
    if (!rateByMonth.has(key)) {
      rateByMonth.set(key, safeRates({ usd_brl: Number(r.usdBrl), usd_ars: Number(r.usdArs) }));
    }
  }
  // Mês sem cotação registrada usa a mais próxima anterior, e no limite a atual.
  const rateForMonth = (key: string): RatesMap => {
    const exata = rateByMonth.get(key);
    if (exata) return exata;
    const anteriores = [...rateByMonth.keys()].filter((k) => k < key).sort();
    const maisProxima = anteriores[anteriores.length - 1];
    return maisProxima ? rateByMonth.get(maisProxima)! : rate;
  };

  // Agrupar despesas por "YYYY-MM" em JS (evita mismatch de locale com SQL)
  const expenseMap = new Map<string, number>();
  for (const t of expenseTransactions) {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    const v = convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', rateForMonth(key));
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + v);
  }

  // Agrupar receitas avulsas reais por "YYYY-MM" (mesma base usada no fluxo de caixa)
  const incomeTxMap = new Map<string, number>();
  for (const t of sixMonthIncomeTx) {
    const key = t.date.slice(0, 7);
    const v = convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', rateForMonth(key));
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

    const monthRate = rateForMonth(key);

    let monthIncome = 0;
    for (const c of nonCancelledContracts) {
      const dueDate = dayInMonth(d, c.billingDay ?? 5);
      if (dueDate >= monthStartStr && dueDate <= monthEndStr && dueDate >= c.startDate && (c.endDate == null || dueDate <= c.endDate)) {
        monthIncome += convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', monthRate);
      }
    }

    // MRR do mês: contratos vigentes naquele mês (sem depender do dia exato de
    // vencimento nem de receita avulsa) — é o "quanto estava contratado", não o caixa.
    // O ponto do mês corrente usa a mesma régua do card MRR (contrato vigente na
    // data de referência), para os dois números fecharem. Nos meses passados vale
    // a vigência dentro do mês, senão um contrato encerrado sumiria dos meses em
    // que ainda estava valendo.
    let monthMrr = 0;
    const mesCorrente = key === today.slice(0, 7);
    for (const c of nonCancelledContracts) {
      // O gráfico é sempre dos últimos 6 meses reais, então a referência do mês
      // corrente é HOJE, e não a data final do período escolhido na barra. Usar o
      // período aqui faria o ponto do mês atual mudar de significado quando a
      // pessoa navegasse para um mês passado.
      const vigente = mesCorrente
        ? c.startDate <= today && (c.endDate == null || c.endDate >= today)
        : c.startDate <= monthEndStr && (c.endDate == null || c.endDate >= monthStartStr);
      if (vigente) {
        monthMrr += convertAmount(parseFloat(c.fixedAmount ?? '0'), (c.currency ?? 'BRL') as Currency, 'BRL', monthRate);
      }
    }

    for (const t of sixMonthRecurringPast) {
      const originalDay = new Date(t.date + 'T12:00:00').getDate();
      const dateStr = dayInMonth(d, originalDay);
      if (dateStr >= monthStartStr && dateStr <= monthEndStr && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        monthIncome += convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', monthRate);
      }
    }
    monthIncome += incomeTxMap.get(key) ?? 0;

    // Despesa recorrente projetada, do mesmo jeito que a receita. Sem isso, a
    // linha de saldo do gráfico era otimista por construção: receita projetada
    // contra despesa só realizada.
    let monthExpenseTotal = expenseMap.get(key) ?? 0;
    for (const t of expenseRecurringPast) {
      const originalDay = new Date(t.date + 'T12:00:00').getDate();
      const dateStr = dayInMonth(d, originalDay);
      if (dateStr >= monthStartStr && dateStr <= monthEndStr && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        monthExpenseTotal += convertAmount(parseFloat(t.amount ?? '0'), (t.currency ?? 'BRL') as Currency, 'BRL', monthRate);
      }
    }

    chartData.push({
      month: label,
      income: monthIncome,
      expense: monthExpenseTotal,
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

  // Valor em risco: soma das faturas vencidas e não pagas, na moeda de exibição.
  const overdueAmount = overdueInvoices.reduce(
    (sum, i) => sum + convertAmount(parseFloat(i.amount ?? '0'), (i.currency ?? 'BRL') as Currency, displayCurrency, rate),
    0
  );
  const overdueClients = new Set(overdueInvoices.map((i) => i.clientId).filter(Boolean)).size;

  return {
    periodIncome,
    periodReceived,
    periodToReceive,
    periodExpense,
    // Mesmos números do período anterior, para a tela mostrar a variação sem
    // recalcular nada no componente.
    previousPeriod: prev,
    previous: {
      received: anterior.received,
      toReceive: anterior.toReceive,
      expense: anterior.expense,
      income: anterior.received + anterior.toReceive,
      balance: anterior.received - anterior.expense,
      mrr: mrrPrev,
    },
    sourceBreakdown,
    sourceTrendData,
    sourceSeries,
    activeClients,
    overdueClients,
    overdueAmount,
    contratosNovos,
    contratosEncerrados,
    rate,
    displayCurrency,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    mrr,
    chartData,
  };
}

// ─── FLUXO DE CAIXA ────────────────────────────
// Fonte única usada tanto pela página humana (app/(dashboard)/cash-flow/page.tsx)
// quanto pela API do agente (GET /api/agent/v1/dashboard/cash-flow).

export async function getCashFlowData(from: string, to: string) {
  const [
    txData,
    recurringFromPast,
    contractData,
    latestRate,
    displayCurrencySetting,
    clientList,
    cashConfirmations,
  ] = await Promise.all([
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
    // Quais honorários do intervalo já estão confirmados como pagos.
    db
      .select({ contractId: paymentConfirmations.contractId, dueDate: paymentConfirmations.dueDate })
      .from(paymentConfirmations)
      .where(and(gte(paymentConfirmations.dueDate, from), lte(paymentConfirmations.dueDate, to))),
  ]);

  const confirmedKeys = new Set(cashConfirmations.map((c) => `${c.contractId}|${c.dueDate}`));

  // Mesma resolução de cotação do dashboard. Esta função tinha uma cópia própria
  // que, se UMA das duas taxas estivesse inválida, jogava as DUAS para o valor
  // fixo antigo. Resultado: o mesmo contrato em dólar aparecia com valor
  // diferente aqui e no dashboard, no mesmo período.
  const rateRow = latestRate[0];
  const rate = safeRates(
    rateRow ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) } : null
  );

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
          // Para a tela poder marcar como pago e mostrar o estado real do
          // vencimento. Antes o fluxo de caixa decidia pago ou não pago só pela
          // data, enquanto o dashboard já decidia pela confirmação: honorário
          // vencido e não pago aparecia como entrada normal aqui e como "a
          // receber" lá, e as duas telas discordavam.
          contractId: c.id,
          dueDate: dateStr,
          clientName: c.clientName ?? null,
          confirmed: confirmedKeys.has(`${c.id}|${dateStr}`),
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

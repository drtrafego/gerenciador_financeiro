import { desc, and, eq, isNull, gte, lte, lt, or, sql } from 'drizzle-orm';
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
  type NewClient,
  type NewContract,
  type NewInvoice,
  type NewTransaction,
  type NewRecurringExpense,
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

// ─── AUTH (repo base) ────────────────────────

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) return null;

  const sessionData = await verifyToken(sessionCookie.value);
  if (!sessionData || !sessionData.user || typeof sessionData.user.id !== 'number') return null;
  if (new Date(sessionData.expires) < new Date()) return null;

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  return user[0] ?? null;
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
  const [clientContracts, clientInvoices] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.clientId, id)).orderBy(desc(contracts.createdAt)),
    db.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.createdAt)),
  ]);
  return { ...client, contracts: clientContracts, invoices: clientInvoices };
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
  await db.delete(contracts).where(eq(contracts.id, id));
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
    .select({ transaction: transactions, clientName: clients.name })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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

// ─── MÉTRICAS DO DASHBOARD ────────────────────

export async function getDashboardMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]!;

  const [paidInvoices, openInvoices, overdueInvoices, activeClientsRow, activeContracts] =
    await Promise.all([
      db.select().from(invoices).where(
        and(eq(invoices.status, 'paid'), gte(invoices.dueDate, startOfMonth), lte(invoices.dueDate, endOfMonth))
      ),
      db.select().from(invoices).where(eq(invoices.status, 'sent')),
      db.select({ invoice: invoices, clientName: clients.name })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(invoices.status, 'overdue'))
        .orderBy(desc(invoices.dueDate))
        .limit(5),
      db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.status, 'active')),
      db.select().from(contracts).where(eq(contracts.status, 'active')),
    ]);

  const mrr = activeContracts.reduce((sum, c) => sum + parseFloat(c.fixedAmount ?? '0'), 0);

  return {
    paidThisMonth: paidInvoices.reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0),
    openAmount: openInvoices.reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0),
    overdueAmount: overdueInvoices.reduce((s, r) => s + parseFloat(r.invoice.amount ?? '0'), 0),
    activeClients: Number(activeClientsRow[0]?.count ?? 0),
    activeContracts: activeContracts.length,
    mrr,
    overdueInvoices,
  };
}

export async function getCashFlowByMonth(months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().split('T')[0]!;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]!;

    const [incomeRows, expenseRows] = await Promise.all([
      db.select().from(transactions).where(
        and(eq(transactions.type, 'income'), gte(transactions.date, start), lte(transactions.date, end))
      ),
      db.select().from(transactions).where(
        and(eq(transactions.type, 'expense'), gte(transactions.date, start), lte(transactions.date, end))
      ),
    ]);

    result.push({
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      income: incomeRows.reduce((s, t) => s + parseFloat(t.amount ?? '0'), 0),
      expense: expenseRows.reduce((s, t) => s + parseFloat(t.amount ?? '0'), 0),
    });
  }

  return result;
}

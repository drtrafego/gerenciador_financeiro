import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uuid,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────
// REPO BASE — mantido para compatibilidade com auth JWT existente
// ─────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

// ─────────────────────────────────────────────
// MÓDULOS DA AGÊNCIA
// ─────────────────────────────────────────────

// Cotações de moeda (atualizado via cron diário)
export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  usdBrl: decimal('usd_brl', { precision: 10, scale: 4 }).notNull(),
  usdArs: decimal('usd_ars', { precision: 10, scale: 4 }).notNull(),
  arsBrl: decimal('ars_brl', { precision: 10, scale: 6 }).notNull(),
  source: text('source').default('frankfurter'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
});

// Configurações globais do sistema
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Clientes da agência
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  currency: text('currency').default('BRL'), // BRL | USD | ARS
  status: text('status').default('active'), // active | inactive | overdue
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Contratos vinculados a clientes
export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  type: text('type').notNull(), // fixed_fee | fixed_plus_percentage | project
  fixedAmount: decimal('fixed_amount', { precision: 10, scale: 2 }).notNull(),
  percentage: decimal('percentage', { precision: 5, scale: 2 }),
  adBudget: decimal('ad_budget', { precision: 10, scale: 2 }),
  currency: text('currency').default('BRL'),
  billingDay: integer('billing_day').default(5),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: text('status').default('active'), // active | paused | cancelled
  description: text('description'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Faturas emitidas
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: text('invoice_number').unique(),
  clientId: uuid('client_id').references(() => clients.id),
  contractId: uuid('contract_id').references(() => contracts.id),
  type: text('type').notNull(), // monthly | project | proposal
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('BRL'),
  status: text('status').default('draft'), // draft | sent | paid | overdue | cancelled
  dueDate: date('due_date').notNull(),
  paidAt: timestamp('paid_at'),
  description: text('description'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transações financeiras (receitas e despesas)
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // income | expense
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('BRL'),
  date: date('date').notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  clientId: uuid('client_id').references(() => clients.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Custos recorrentes mensais da agência
export const recurringExpenses = pgTable('recurring_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('BRL'),
  dayOfMonth: integer('day_of_month').default(1),
  active: text('active').default('true'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, { fields: [invitations.teamId], references: [teams.id] }),
  invitedBy: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, { fields: [activityLogs.teamId], references: [teams.id] }),
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  contracts: many(contracts),
  invoices: many(invoices),
  transactions: many(transactions),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  client: one(clients, { fields: [contracts.clientId], references: [clients.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  contract: one(contracts, { fields: [invoices.contractId], references: [contracts.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  invoice: one(invoices, { fields: [transactions.invoiceId], references: [invoices.id] }),
  client: one(clients, { fields: [transactions.clientId], references: [clients.id] }),
}));

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type NewRecurringExpense = typeof recurringExpenses.$inferInsert;

export type ClientStatus = 'active' | 'inactive' | 'overdue';
export type ContractType = 'fixed_fee' | 'fixed_plus_percentage' | 'project';
export type ContractStatus = 'active' | 'paused' | 'cancelled';
export type InvoiceType = 'monthly' | 'project' | 'proposal';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type TransactionType = 'income' | 'expense';
export type Currency = 'BRL' | 'USD' | 'ARS';

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

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
  boolean,
  uniqueIndex,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  document: text('document'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  currency: text('currency').default('BRL'), // BRL | USD | ARS
  status: text('status').default('active'), // active | inactive | overdue
  source: text('source'), // referral | organic | meta | google (origem/canal de aquisição)
  isTest: boolean('is_test').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Contratos vinculados a clientes
export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  name: text('name'), // ex: "Gestão de Tráfego Meta Ads", "Google Ads"
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
  paymentMethod: text('payment_method'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transações financeiras (receitas e despesas)
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // income | expense
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // valor efetivo (com IOF aplicado, se houver)
  baseAmount: decimal('base_amount', { precision: 10, scale: 2 }),   // valor original digitado, sem IOF
  iof: boolean('iof').default(false),                                // se true, amount = baseAmount * 1.0338
  currency: text('currency').default('BRL'),
  date: date('date').notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  clientId: uuid('client_id').references(() => clients.id),
  // Recorrência
  isRecurring: text('is_recurring').default('false'),     // 'true' | 'false'
  recurringActive: text('recurring_active').default('true'), // 'true' | 'false'
  recurringEndsAt: date('recurring_ends_at'),               // null = para sempre
  createdAt: timestamp('created_at').defaultNow(),
});

// Custos recorrentes mensais da agência
export const recurringExpenses = pgTable('recurring_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // valor efetivo (com IOF aplicado, se houver)
  baseAmount: decimal('base_amount', { precision: 10, scale: 2 }),   // valor original digitado, sem IOF
  iof: boolean('iof').default(false),                                // se true, amount = baseAmount * 1.0338
  currency: text('currency').default('BRL'),
  dayOfMonth: integer('day_of_month').default(1),
  active: text('active').default('true'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─────────────────────────────────────────────
// MÓDULO LEMBRETES WHATSAPP
// ─────────────────────────────────────────────

// Templates de mensagem (genérico ou por cliente)
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  body: text('body').notNull(), // variáveis: {nome}, {valor}, {data}, {dias}
  isDefault: text('is_default').default('false'), // 'true' | 'false'
  clientId: uuid('client_id').references(() => clients.id), // null = genérico
  createdAt: timestamp('created_at').defaultNow(),
});

// Lembretes agendados
export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  contractId: uuid('contract_id').references(() => contracts.id),
  phone: text('phone').notNull(),
  templateId: uuid('template_id').references(() => messageTemplates.id),
  customMessage: text('custom_message'), // substitui template se preenchido
  triggerDate: date('trigger_date').notNull(), // data de envio
  triggerTime: text('trigger_time').default('08:00'), // hora de envio HH:MM
  startDate: date('start_date'),
  endDate: date('end_date'),
  recurring: boolean('recurring').default(false),
  status: text('status').default('pending'), // pending | sent | failed | cancelled | completed
  // Etapa do ciclo de cobrança daquele vencimento:
  // due = aviso do dia do vencimento (é o que toda linha histórica representa),
  // overdue_d2 e overdue_d5 = cobranças de atraso. triggerDate continua sendo a
  // data de VENCIMENTO canônica, nunca a data efetiva de envio.
  stage: text('stage').notNull().default('due'), // due | overdue_d2 | overdue_d5
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Um contrato só pode ter um lembrete por data de vencimento E etapa (dedupe do cron)
  contractDueDateStageUnique: uniqueIndex('reminders_contract_duedate_stage_unique')
    .on(table.contractId, table.triggerDate, table.stage)
    .where(sql`${table.contractId} IS NOT NULL`),
  stageTriggerDateIdx: index('reminders_stage_triggerdate_idx').on(table.stage, table.triggerDate),
}));

// Confirmação de pagamento de um vencimento (contrato + data de vencimento).
// Tabela própria porque lembrete pode ser apagado e a confirmação não pode sumir
// junto. Confirmar pagamento aqui NUNCA cria transaction nem mexe em fatura:
// serve só para interromper as cobranças automáticas de atraso daquele vencimento.
export const paymentConfirmations = pgTable('payment_confirmations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => contracts.id),
  dueDate: date('due_date').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  source: text('source').notNull().default('panel'), // panel | agent
  actor: text('actor'), // e-mail do usuário do painel ou x-agent-actor
  note: text('note'),
  confirmedAt: timestamp('confirmed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  contractDueDateUnique: uniqueIndex('payment_confirmations_contract_duedate_unique')
    .on(table.contractId, table.dueDate),
  dueDateIdx: index('payment_confirmations_duedate_idx').on(table.dueDate),
}));

// ─────────────────────────────────────────────
// MÓDULO AGENTE EXTERNO (API + auditoria)
// ─────────────────────────────────────────────

// Log de auditoria de toda chamada feita pelo super agente externo (leitura e escrita)
export const agentAuditLog = pgTable('agent_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actor: text('actor').notNull().default('agent'), // texto livre do header x-agent-actor, nunca usado para autorizar
  method: text('method').notNull(), // GET | POST | PATCH | DELETE
  endpoint: text('endpoint').notNull(), // path chamado
  resourceType: text('resource_type'), // client | contract | transaction | invoice | reminder | dashboard
  resourceId: text('resource_id'),
  requestBody: jsonb('request_body'), // payload já validado pelo Zod; null em GET
  beforeData: jsonb('before_data'), // snapshot antes da mutação (update); null em create/read
  afterData: jsonb('after_data'), // snapshot depois da mutação; null em read/delete
  statusCode: integer('status_code').notNull(),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  actorCreatedAtIdx: index('agent_audit_log_actor_created_at_idx').on(table.actor, table.createdAt),
  endpointCreatedAtIdx: index('agent_audit_log_endpoint_created_at_idx').on(table.endpoint, table.createdAt),
}));

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

export const paymentConfirmationsRelations = relations(paymentConfirmations, ({ one }) => ({
  client: one(clients, { fields: [paymentConfirmations.clientId], references: [clients.id] }),
  contract: one(contracts, { fields: [paymentConfirmations.contractId], references: [contracts.id] }),
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
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type AgentAuditLog = typeof agentAuditLog.$inferSelect;
export type NewAgentAuditLog = typeof agentAuditLog.$inferInsert;
export type PaymentConfirmation = typeof paymentConfirmations.$inferSelect;
export type NewPaymentConfirmation = typeof paymentConfirmations.$inferInsert;

export type ClientStatus = 'active' | 'inactive' | 'overdue';
export type ContractType = 'fixed_fee' | 'fixed_plus_percentage' | 'project';
export type ContractStatus = 'active' | 'paused' | 'cancelled';
export type InvoiceType = 'monthly' | 'project' | 'proposal';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type TransactionType = 'income' | 'expense';
export type Currency = 'BRL' | 'USD' | 'ARS';
export type ReminderStage = 'due' | 'overdue_d2' | 'overdue_d5';
export type PaymentConfirmationSource = 'panel' | 'agent';

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

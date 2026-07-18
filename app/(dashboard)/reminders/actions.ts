'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, invoices, systemSettings } from '@/lib/db/schema';
import { eq, desc, and, lte, eq as eqOp } from 'drizzle-orm';
import { z } from 'zod';
import { getUser } from '@/lib/db/queries';

// ── TEMPLATES ─────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1),
  body: z.string().min(1),
  clientId: z.string().uuid().optional().nullable(),
});

export async function createTemplateAction(formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = templateSchema.parse({ ...raw, clientId: raw.clientId || null });

  await db.insert(messageTemplates).values({
    name: parsed.name,
    body: parsed.body,
    clientId: parsed.clientId ?? null,
  });
  revalidatePath('/reminders');
}

export async function updateTemplateAction(id: string, formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = templateSchema.parse({ ...raw, clientId: raw.clientId || null });

  await db
    .update(messageTemplates)
    .set({ name: parsed.name, body: parsed.body, clientId: parsed.clientId ?? null })
    .where(eq(messageTemplates.id, id));
  revalidatePath('/reminders');
}

export async function deleteTemplateAction(id: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  revalidatePath('/reminders');
}

// Marca um template como o padrão usado na automação de vencimentos.
// Só um template fica como padrão por vez.
export async function setDefaultTemplateAction(id: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.transaction(async (tx) => {
    await tx.update(messageTemplates).set({ isDefault: 'false' });
    await tx.update(messageTemplates).set({ isDefault: 'true' }).where(eq(messageTemplates.id, id));
  });
  revalidatePath('/reminders');
}

// ── LEMBRETES ─────────────────────────────────

const reminderSchema = z.object({
  clientId: z.string().uuid(),
  phone: z.string().min(10),
  triggerDate: z.string().min(1),
  triggerTime: z.string().default('08:00'),
  templateId: z.string().uuid().optional().nullable(),
  customMessage: z.string().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  recurring: z.boolean().optional().default(false),
});

export async function createReminderAction(formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = reminderSchema.parse({
    ...raw,
    templateId: raw.templateId || null,
    customMessage: raw.customMessage || null,
    invoiceId: raw.invoiceId || null,
    contractId: raw.contractId || null,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    recurring: raw.recurring === 'true',
  });

  await db.insert(reminders).values({
    clientId: parsed.clientId,
    phone: parsed.phone,
    triggerDate: parsed.triggerDate,
    triggerTime: parsed.triggerTime,
    templateId: parsed.templateId ?? null,
    customMessage: parsed.customMessage ?? null,
    invoiceId: parsed.invoiceId ?? null,
    contractId: parsed.contractId ?? null,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
    recurring: parsed.recurring,
    status: 'pending',
  });
  revalidatePath('/reminders');
}

export async function cancelReminderAction(id: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.update(reminders).set({ status: 'cancelled' }).where(eq(reminders.id, id));
  revalidatePath('/reminders');
}

const updateReminderSchema = reminderSchema.omit({ clientId: true, invoiceId: true, contractId: true });

export async function updateReminderAction(id: string, formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateReminderSchema.parse({
    ...raw,
    templateId: raw.templateId || null,
    customMessage: raw.customMessage || null,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    recurring: raw.recurring === 'true',
  });

  await db
    .update(reminders)
    .set({
      phone: parsed.phone,
      triggerDate: parsed.triggerDate,
      triggerTime: parsed.triggerTime,
      templateId: parsed.templateId ?? null,
      customMessage: parsed.customMessage ?? null,
      startDate: parsed.startDate ?? null,
      endDate: parsed.endDate ?? null,
      recurring: parsed.recurring,
      status: 'pending',
      sentAt: null,
      errorMessage: null,
    })
    .where(eq(reminders.id, id));

  revalidatePath('/reminders');
}

export async function deleteReminderAction(id: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.delete(reminders).where(eq(reminders.id, id));
  revalidatePath('/reminders');
}

// Gera lembretes automáticos para faturas com vencimento próximo
// ── CONFIGURAÇÕES ─────────────────────────────────

export async function getSettingAction(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function saveAlertPhoneAction(phone: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db
    .insert(systemSettings)
    .values({ key: 'alert_phone', value: phone })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: phone, updatedAt: new Date() } });
  revalidatePath('/reminders');
}

export async function generateRemindersFromInvoicesAction(daysBefore: number, time: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + daysBefore);
  const targetDate = future.toISOString().split('T')[0]!;

  // Busca faturas vencendo nessa data que ainda não têm lembrete pendente
  const pendingInvoices = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.dueDate, targetDate),
        eq(invoices.status, 'sent')
      )
    );

  const [defaultTemplate] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.isDefault, 'true'))
    .limit(1);

  let created = 0;
  for (const row of pendingInvoices) {
    if (!row.client?.phone) continue;

    // Verifica se já existe lembrete pendente para essa fatura
    const existing = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.invoiceId, row.invoice.id),
          eq(reminders.status, 'pending')
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(reminders).values({
      clientId: row.invoice.clientId,
      invoiceId: row.invoice.id,
      phone: row.client.phone,
      templateId: defaultTemplate?.id ?? null,
      triggerDate: new Date().toISOString().split('T')[0]!,
      triggerTime: time,
      status: 'pending',
    });
    created++;
  }

  revalidatePath('/reminders');
  return { created };
}

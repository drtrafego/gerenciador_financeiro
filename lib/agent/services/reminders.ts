import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, reminders } from '@/lib/db/schema';
import {
  getReminderById,
  createReminder,
  updateReminder,
  cancelReminder,
  deleteReminder,
  getMessageTemplates,
  createMessageTemplate,
} from '@/lib/db/queries';
import { sendWhatsApp, buildReminderMessage } from '@/lib/wpp/send';
import { notFound, badRequest } from '../errors';

const reminderCreateSchema = z.object({
  clientId: z.string().uuid(),
  phone: z.string().min(10),
  triggerDate: z.string().min(1),
  triggerTime: z.string().default('08:00'),
  templateId: z.string().uuid().nullable().optional(),
  customMessage: z.string().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  recurring: z.boolean().optional().default(false),
});

const reminderUpdateSchema = reminderCreateSchema.partial();

const templateCreateSchema = z.object({
  name: z.string().min(1),
  body: z.string().min(1),
  clientId: z.string().uuid().nullable().optional(),
});

export async function listReminders({
  status,
  limit,
  offset,
}: {
  status?: string;
  limit: number;
  offset: number;
}) {
  const where = status ? eq(reminders.status, status) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ reminder: reminders, clientName: clients.name })
      .from(reminders)
      .leftJoin(clients, eq(reminders.clientId, clients.id))
      .where(where)
      .orderBy(desc(reminders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(reminders).where(where),
  ]);
  return { data: rows, count: Number(count) };
}

export async function createReminderService(input: unknown) {
  const parsed = reminderCreateSchema.parse(input);
  const reminder = await createReminder({
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
    recurring: parsed.recurring ?? false,
    status: 'pending',
  });
  revalidatePath('/reminders');
  return { reminder, parsed };
}

export async function updateReminderService(id: string, input: unknown) {
  const beforeRow = await getReminderById(id);
  if (!beforeRow) throw notFound('Lembrete');

  const parsed = reminderUpdateSchema.parse(input);
  const reminder = await updateReminder(id, {
    ...(parsed.clientId !== undefined && { clientId: parsed.clientId }),
    ...(parsed.phone !== undefined && { phone: parsed.phone }),
    ...(parsed.triggerDate !== undefined && { triggerDate: parsed.triggerDate }),
    ...(parsed.triggerTime !== undefined && { triggerTime: parsed.triggerTime }),
    ...(parsed.templateId !== undefined && { templateId: parsed.templateId ?? null }),
    ...(parsed.customMessage !== undefined && { customMessage: parsed.customMessage ?? null }),
    ...(parsed.invoiceId !== undefined && { invoiceId: parsed.invoiceId ?? null }),
    ...(parsed.contractId !== undefined && { contractId: parsed.contractId ?? null }),
    ...(parsed.startDate !== undefined && { startDate: parsed.startDate ?? null }),
    ...(parsed.endDate !== undefined && { endDate: parsed.endDate ?? null }),
    ...(parsed.recurring !== undefined && { recurring: parsed.recurring }),
    // Editar um lembrete volta o status para pendente, igual ao painel humano.
    status: 'pending',
    sentAt: null,
    errorMessage: null,
  });
  revalidatePath('/reminders');
  return { before: beforeRow.reminder, after: reminder, parsed };
}

export async function cancelReminderService(id: string) {
  const before = await getReminderById(id);
  if (!before) throw notFound('Lembrete');

  const reminder = await cancelReminder(id);
  revalidatePath('/reminders');
  return { before: before.reminder, after: reminder };
}

export async function deleteReminderService(id: string) {
  const before = await getReminderById(id);
  if (!before) throw notFound('Lembrete');

  await deleteReminder(id);
  revalidatePath('/reminders');
  return { before: before.reminder };
}

// Dispara o envio imediatamente (mesmo caminho que o cron usa hoje): resolve a
// mensagem via lib/wpp/send.ts, chama o whatsapp-service e atualiza status/sentAt/
// errorMessage do reminder conforme o resultado.
export async function sendNowReminderService(id: string) {
  const row = await getReminderById(id);
  if (!row) throw notFound('Lembrete');

  const { reminder, template, client, invoice, contract } = row;
  const message = buildReminderMessage({ reminder, template, client, invoice, contract, now: new Date() });

  if (!message) {
    throw badRequest('Lembrete sem mensagem: preencha customMessage ou vincule um template.');
  }

  const { ok, error } = await sendWhatsApp(reminder.phone, message);

  let after;
  if (ok) {
    if (reminder.recurring) {
      const current = new Date(reminder.triggerDate + 'T12:00:00');
      current.setMonth(current.getMonth() + 1);
      const nextDate = current.toISOString().split('T')[0]!;
      const isExpired = reminder.endDate && nextDate > reminder.endDate;
      after = await updateReminder(id, {
        triggerDate: nextDate,
        sentAt: new Date(),
        status: isExpired ? 'completed' : 'pending',
        errorMessage: null,
      });
    } else {
      after = await updateReminder(id, {
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      });
    }
  } else {
    after = await updateReminder(id, {
      status: 'failed',
      errorMessage: error,
    });
  }

  revalidatePath('/reminders');
  return { before: reminder, after, sent: ok, error };
}

export async function listMessageTemplatesService() {
  return getMessageTemplates();
}

export async function createMessageTemplateService(input: unknown) {
  const parsed = templateCreateSchema.parse(input);
  const template = await createMessageTemplate({
    name: parsed.name,
    body: parsed.body,
    clientId: parsed.clientId ?? null,
  });
  revalidatePath('/reminders');
  return { template, parsed };
}

'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, invoices, systemSettings } from '@/lib/db/schema';
import { eq, desc, and, lte, eq as eqOp } from 'drizzle-orm';
import { z } from 'zod';
import { getUser } from '@/lib/db/queries';
import { after } from 'next/server';
import { unconfirmPayment, cancelPendingDunning } from '@/lib/billing/confirmations';
import { confirmPaymentAndIssueReceipt } from '@/lib/billing/receipts';
import { sendReceiptForInvoice } from '@/lib/billing/sendReceipt';

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

// ── CONFIRMAÇÃO DE PAGAMENTO ──────────────────
// Confirmar pagamento interrompe as cobranças automáticas de atraso daquele
// vencimento E, desde a emissão automática de recibo, gera a fatura quitada e
// manda o recibo por e-mail ao cliente. Continua sem lançar receita no fluxo de
// caixa: quem responde por "entrou dinheiro" é a própria confirmação, e criar
// transação aqui faria o valor contar duas vezes no dashboard.
//
// O mesmo caminho é usado pelo botão do fluxo de caixa
// (app/(dashboard)/cash-flow/actions.ts), para os dois lugares se comportarem igual.

export async function confirmPaymentAction(contractId: string, dueDate: string, note?: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');

  // Devolve o erro em vez de estourar: a chamada vem de dentro de um
  // startTransition no painel, onde uma exceção não apareceria na tela e o
  // operador clicaria achando que confirmou.
  try {
    const resultado = await confirmPaymentAndIssueReceipt({
      contractId,
      dueDate,
      source: 'panel',
      actor: user.email,
      note: note ?? null,
    });
    const { alreadyConfirmed, invoice } = resultado;
    const dunningCancelled = await cancelPendingDunning(contractId, dueDate);

    if (invoice && resultado.emailStatus === 'pending') {
      after(async () => {
        await sendReceiptForInvoice(invoice.id);
      });
    }

    revalidatePath('/reminders');
    revalidatePath('/cash-flow');
    revalidatePath('/dashboard');
    revalidatePath('/invoices');
    return {
      ok: true as const,
      alreadyConfirmed,
      dunningCancelled,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      emailTo: resultado.emailTo,
      emailSkipped: resultado.emailStatus === 'skipped_no_email',
      // Por que a fatura não saiu, quando não saiu. A tela precisa dizer isso:
      // confirmar sem emitir nada, em silêncio, faz o operador achar que o
      // cliente recebeu o recibo. Vale tanto para o caso pulado de propósito
      // quanto para a falha real de emissão.
      invoiceSkipped: resultado.skipped,
      invoiceError: resultado.error,
    };
  } catch (err) {
    console.error('[reminders] falha ao confirmar pagamento', err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.',
    };
  }
}

export async function undoPaymentConfirmationAction(contractId: string, dueDate: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');

  try {
    const result = await unconfirmPayment({ contractId, dueDate });
    revalidatePath('/reminders');
    return { ok: true as const, ...result };
  } catch (err) {
    console.error('[reminders] falha ao desfazer confirmação de pagamento', err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Não foi possível desfazer a confirmação.',
    };
  }
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

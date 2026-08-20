import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, messageTemplates, paymentConfirmations, reminders } from '@/lib/db/schema';
import {
  getReminderById,
  createReminder,
  updateReminder,
  cancelReminder,
  deleteReminder,
  getMessageTemplates,
  createMessageTemplate,
} from '@/lib/db/queries';
import {
  sendWhatsApp,
  buildReminderMessage,
  buildAutomaticBillingMessage,
  DEFAULT_TEMPLATE_BODY,
  MISSING_PHONE_ERROR,
} from '@/lib/wpp/send';
import { notFound, badRequest } from '../errors';

// "stage" NÃO entra neste schema de propósito: quem define a etapa do ciclo de
// cobrança (due, overdue_d2, overdue_d5) é o cron, nunca o chamador da API.
// Lembrete criado por aqui é sempre avulso e nasce com o default 'due' do banco.
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
  stage,
  limit,
  offset,
}: {
  status?: string;
  stage?: string;
  limit: number;
  offset: number;
}) {
  const conditions = [
    ...(status ? [eq(reminders.status, status)] : []),
    ...(stage ? [eq(reminders.stage, stage)] : []),
  ];
  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
    // O "stage" NUNCA é tocado aqui: uma linha de cobrança D+2 continua sendo
    // D+2 depois de editada. Quem mexer neste bloco no futuro, não acrescente
    // stage, senão a dedupe (contract_id, trigger_date, stage) quebra.
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

  // Cobrança de atraso com pagamento já confirmado não é reenviada por ninguém.
  if (reminder.contractId && (reminder.stage === 'overdue_d2' || reminder.stage === 'overdue_d5')) {
    const [confirmacao] = await db
      .select()
      .from(paymentConfirmations)
      .where(
        and(
          eq(paymentConfirmations.contractId, reminder.contractId),
          eq(paymentConfirmations.dueDate, reminder.triggerDate)
        )
      )
      .limit(1);
    if (confirmacao) {
      const dataBr = new Date(reminder.triggerDate + 'T12:00:00').toLocaleDateString('pt-BR');
      throw badRequest(
        `Vencimento já confirmado como pago em ${dataBr}. Desfaça a confirmação antes de cobrar.`
      );
    }
  }

  // Em linha de cobrança automática sem customMessage salva, o servidor
  // reconstrói o texto certo da etapa (primeira parcela, vencimento adiado por
  // fim de semana, D+2 ou D+5) em vez de cair no template genérico do painel,
  // que fala em vencimento futuro.
  const automatica = reminder.customMessage
    ? null
    : buildAutomaticBillingMessage({ reminder, client, contract });

  // Vencimento comum sem template vinculado: é a linha que o cron cria como
  // falha quando o cliente está sem telefone cadastrado, cenário comum em
  // contrato recém assinado. Sem este fallback o reenvio morre em "Lembrete sem
  // mensagem", porque não há customMessage nem template na linha.
  // Restrito à linha que o cron cria como falha quando o cliente está sem
  // telefone cadastrado, que é a única que nasce sem customMessage e sem
  // template. Qualquer outro lembrete sem texto continua recusado com 400 de
  // propósito: a API deixa criar lembrete com contractId e sem mensagem, e sem
  // esse freio o agente externo mandaria cobrança que ninguém revisou.
  let templateFallback: { body: string } | null = template;
  if (
    !automatica &&
    !reminder.customMessage &&
    !templateFallback &&
    reminder.errorMessage === MISSING_PHONE_ERROR &&
    (reminder.contractId || reminder.invoiceId)
  ) {
    const [padrao] = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.isDefault, 'true'))
      .limit(1);
    templateFallback = padrao ?? { body: DEFAULT_TEMPLATE_BODY };
  }

  const message =
    automatica ??
    buildReminderMessage({
      reminder,
      template: templateFallback,
      client,
      invoice,
      contract,
      now: new Date(),
    });

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

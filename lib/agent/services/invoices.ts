import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, invoices } from '@/lib/db/schema';
import { getInvoiceById, getInvoiceWithClient, createInvoice, updateInvoice, markInvoicePaid } from '@/lib/db/queries';
import { sendReceiptEmail } from '@/lib/email/gmail';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { notFound, badRequest } from '../errors';

const invoiceCreateSchema = z.object({
  clientId: z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
  type: z.enum(['monthly', 'project', 'proposal']),
  amount: z.number().positive(),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  dueDate: z.string().min(1),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
});

// Fatura nunca é marcada como paga por aqui (existe POST /invoices/:id/mark-paid
// específico, que segue a regra de nunca criar transaction / nunca entrar no fluxo de caixa).
const invoiceStatusSchema = z.enum(['draft', 'sent', 'cancelled']);

const invoiceSendSchema = z.object({
  to: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
});

export async function listInvoices({ limit, offset }: { limit: number; offset: number }) {
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ invoice: invoices, clientName: clients.name })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(invoices),
  ]);
  return { data: rows, count: Number(count) };
}

export async function getInvoiceDetail(id: string) {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw notFound('Fatura');
  return invoice;
}

export async function createInvoiceService(input: unknown) {
  const parsed = invoiceCreateSchema.parse(input);
  const invoice = await createInvoice({
    clientId: parsed.clientId,
    contractId: parsed.contractId ?? null,
    type: parsed.type,
    amount: String(parsed.amount),
    currency: parsed.currency,
    status: 'draft',
    dueDate: parsed.dueDate,
    description: parsed.description ?? null,
    notes: parsed.notes ?? null,
    paymentMethod: parsed.paymentMethod ?? null,
  });
  revalidatePath('/invoices');
  return { invoice, parsed };
}

export async function updateInvoiceStatusService(id: string, input: unknown) {
  const before = await getInvoiceById(id);
  if (!before) throw notFound('Fatura');

  const body = z.object({ status: z.string() }).parse(input);
  if (body.status === 'paid') {
    throw badRequest('Use POST /invoices/:id/mark-paid para marcar uma fatura como paga.');
  }
  const status = invoiceStatusSchema.parse(body.status);

  const invoice = await updateInvoice(id, { status });
  revalidatePath('/invoices');
  return { before, after: invoice, parsed: { status } };
}

// Faturas nunca criam transaction: o fluxo de caixa é alimentado exclusivamente
// por contratos (projeção) e lançamentos manuais.
export async function markInvoicePaidService(id: string) {
  const before = await getInvoiceById(id);
  if (!before) throw notFound('Fatura');

  const invoice = await markInvoicePaid(id);
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  revalidatePath('/cash-flow');
  return { before, after: invoice };
}

// Reaproveita a mesma lógica de montagem de e-mail do painel humano
// (sendReceiptEmailAction em app/(dashboard)/invoices/actions.ts), só troca
// quem dispara e quem resolve o destinatário. Nunca lança exceção genérica em
// falha de SMTP: mesmo padrão de sendWhatsApp em lib/wpp/send.ts, devolve
// { sent, error } para o chamador decidir o que fazer.
export async function sendInvoiceEmailService(id: string, input: unknown) {
  const row = await getInvoiceWithClient(id);
  if (!row) throw notFound('Fatura');
  const { invoice, client } = row;

  if (invoice.status === 'cancelled') {
    throw badRequest('Fatura cancelada não pode ser enviada por e-mail.');
  }

  const parsed = invoiceSendSchema.parse(input ?? {});
  const to = parsed.to ?? client?.email ?? null;
  if (!to) {
    throw badRequest(
      'Cliente não tem e-mail cadastrado. Informe "to" no body ou cadastre o e-mail do cliente antes de enviar.'
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  let sent = true;
  let error: string | null = null;
  try {
    await sendReceiptEmail({
      to,
      clientName: client?.name ?? 'Cliente',
      invoiceNumber: invoice.invoiceNumber ?? id,
      amount: formatCurrency(parseFloat(invoice.amount ?? '0'), (invoice.currency as Currency) ?? 'BRL'),
      dueDate: invoice.dueDate,
      description: invoice.description ?? 'Serviços de gestão de tráfego pago',
      receiptUrl: `${appUrl}/invoice/${id}`,
      isPaid: invoice.status === 'paid',
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    });
  } catch (err) {
    sent = false;
    error = err instanceof Error ? err.message : 'Falha no envio do e-mail';
  }

  // Só promove draft para sent quando o envio realmente funcionou. Fatura já
  // paga, cancelada ou já marcada como sent nunca regride nem é sobrescrita
  // por um reenvio: o campo status continua refletindo o estado real dela.
  let after = invoice;
  if (sent && invoice.status === 'draft') {
    after = await updateInvoice(id, { status: 'sent' });
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
  }

  return { before: invoice, after, sent, error, to };
}

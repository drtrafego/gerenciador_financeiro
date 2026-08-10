import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, invoices } from '@/lib/db/schema';
import { getInvoiceById, createInvoice, updateInvoice, markInvoicePaid } from '@/lib/db/queries';
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

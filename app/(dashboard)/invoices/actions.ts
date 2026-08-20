'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createInvoice, updateInvoice, deleteInvoice, markInvoicePaid, getInvoiceWithClient, getUser, updateTransaction } from '@/lib/db/queries';
import { sendReceiptEmail } from '@/lib/email/gmail';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';

const invoiceSchema = z.object({
  clientId: z.string().uuid(),
  contractId: z.string().optional().transform((v) => v || null),
  transactionId: z.string().optional().transform((v) => v || null),
  type: z.enum(['monthly', 'project', 'proposal']),
  amount: z.string().transform((v) => v.replace(',', '.')),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  dueDate: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export async function createInvoiceAction(formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = invoiceSchema.parse(raw);

  let inv;
  try {
    inv = await createInvoice({
      clientId: parsed.clientId,
      contractId: parsed.contractId ?? null,
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      status: parsed.status,
      dueDate: parsed.dueDate,
      description: parsed.description ?? null,
      notes: parsed.notes ?? null,
      paymentMethod: parsed.paymentMethod ?? null,
      paidAt: null,
      invoiceNumber: null,
    });
  } catch (err) {
    // Desde que a confirmação de pagamento passou a emitir fatura sozinha, existe
    // um índice que impede duas faturas vivas para o mesmo contrato e vencimento.
    // Sem este tratamento o operador veria a mensagem crua do Postgres.
    const codigo = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (codigo === '23505') {
      throw new Error(
        'Já existe uma fatura em aberto para este contrato neste vencimento. Cancele a fatura existente antes de criar outra.'
      );
    }
    throw err;
  }
  if (parsed.transactionId) {
    await updateTransaction(parsed.transactionId, { invoiceId: inv.id });
  }
  revalidatePath('/invoices');
  revalidatePath('/transactions');
  redirect(`/invoices/${inv.id}`);
}

export async function updateInvoiceAction(id: string, formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = invoiceSchema.parse(raw);
  await updateInvoice(id, {
    clientId: parsed.clientId,
    contractId: parsed.contractId ?? null,
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    status: parsed.status,
    dueDate: parsed.dueDate,
    description: parsed.description ?? null,
    notes: parsed.notes ?? null,
    paymentMethod: parsed.paymentMethod ?? null,
  });
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function markInvoicePaidAction(id: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await markInvoicePaid(id);
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/dashboard');
}

export async function deleteInvoiceAction(id: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await deleteInvoice(id);
  revalidatePath('/invoices');
  redirect('/invoices');
}

export async function sendReceiptEmailAction(
  id: string,
  to: string
): Promise<{ ok: boolean }> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  try {
    const row = await getInvoiceWithClient(id);
    if (!row) return { ok: false };

    const { invoice, client } = row;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    await sendReceiptEmail({
      to,
      clientName: client?.name ?? 'Cliente',
      invoiceNumber: invoice.invoiceNumber ?? id,
      amount: formatCurrency(
        parseFloat(invoice.amount ?? '0'),
        (invoice.currency as Currency) ?? 'BRL'
      ),
      dueDate: invoice.dueDate,
      description: invoice.description ?? 'Serviços de gestão de tráfego pago',
      receiptUrl: `${appUrl}/invoice/${id}`,
      isPaid: invoice.status === 'paid',
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

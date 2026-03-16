'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createTransaction, deleteTransaction } from '@/lib/db/queries';

const txSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().transform((v) => v.replace(',', '.')),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  date: z.string().min(1),
  clientId: z.string().optional().transform((v) => v || null),
  invoiceId: z.string().optional().transform((v) => v || null),
});

export async function createTransactionAction(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = txSchema.parse(raw);
  await createTransaction({
    type: parsed.type,
    category: parsed.category,
    description: parsed.description,
    amount: parsed.amount,
    currency: parsed.currency,
    date: parsed.date,
    clientId: parsed.clientId ?? null,
    invoiceId: parsed.invoiceId ?? null,
  });
  revalidatePath('/transactions');
  revalidatePath('/cash-flow');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

export async function deleteTransactionAction(id: string): Promise<void> {
  await deleteTransaction(id);
  revalidatePath('/transactions');
  revalidatePath('/cash-flow');
  redirect('/transactions');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createTransaction, deleteTransaction, getUser } from '@/lib/db/queries';

const txSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().transform((v) => v.replace(',', '.')),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  date: z.string().min(1),
  installments: z.coerce.number().int().min(1).max(60).default(1),
  clientId: z.string().optional().transform((v) => v || null),
  invoiceId: z.string().optional().transform((v) => v || null),
});

// Soma meses a uma data 'YYYY-MM-DD', preservando o dia (com clamp ao fim do mês).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y!, m! - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d!, lastDay);
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

export async function createTransactionAction(formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = txSchema.parse(raw);

  const total = parseFloat(parsed.amount);
  if (!Number.isFinite(total)) throw new Error('Valor inválido');
  const n = parsed.installments;

  if (n <= 1) {
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
  } else {
    // Divide o valor TOTAL em n parcelas mensais; a última absorve o arredondamento.
    const cents = Math.round(total * 100);
    const baseCents = Math.floor(cents / n);
    const remainder = cents - baseCents * n;
    for (let i = 0; i < n; i++) {
      const parcelaCents = baseCents + (i === n - 1 ? remainder : 0);
      await createTransaction({
        type: parsed.type,
        category: parsed.category,
        description: `${parsed.description} (${i + 1}/${n})`,
        amount: (parcelaCents / 100).toFixed(2),
        currency: parsed.currency,
        date: addMonths(parsed.date, i),
        clientId: parsed.clientId ?? null,
        invoiceId: parsed.invoiceId ?? null,
      });
    }
  }

  revalidatePath('/transactions');
  revalidatePath('/cash-flow');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

export async function deleteTransactionAction(id: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await deleteTransaction(id);
  revalidatePath('/transactions');
  revalidatePath('/cash-flow');
  redirect('/transactions');
}

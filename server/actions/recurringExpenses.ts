'use server';

import { revalidatePath } from 'next/cache';
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  getUser,
} from '@/lib/db/queries';

const IOF_RATE = 0.0338;

// Lê valor base + flag de IOF do form e devolve { base, final, iof }.
// O valor digitado (campo amount) é sempre o ORIGINAL; o IOF é aplicado por cima.
function resolveAmounts(formData: FormData) {
  const base = parseFloat((formData.get('amount') as string) ?? '0');
  const currency = (formData.get('currency') as string) ?? 'BRL';
  const iof = currency === 'USD' && formData.get('iof') === 'true';
  const final = iof ? parseFloat((base * (1 + IOF_RATE)).toFixed(2)) : base;
  return { base, final, iof };
}

export async function createRecurringExpenseAction(formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const { base, final, iof } = resolveAmounts(formData);
  await createRecurringExpense({
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    amount: String(final),
    baseAmount: String(base),
    iof,
    currency: (formData.get('currency') as string) ?? 'BRL',
    dayOfMonth: Number(formData.get('dayOfMonth') ?? 1),
    active: 'true',
  });
  revalidatePath('/cash-flow');
}

export async function updateRecurringExpenseAction(id: string, formData: FormData) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const { base, final, iof } = resolveAmounts(formData);
  await updateRecurringExpense(id, {
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    amount: String(final),
    baseAmount: String(base),
    iof,
    currency: (formData.get('currency') as string) ?? 'BRL',
    dayOfMonth: Number(formData.get('dayOfMonth') ?? 1),
  });
  revalidatePath('/cash-flow');
}

export async function toggleRecurringExpenseAction(id: string, active: boolean) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await updateRecurringExpense(id, { active: active ? 'true' : 'false' });
  revalidatePath('/cash-flow');
}

export async function deleteRecurringExpenseAction(id: string) {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await deleteRecurringExpense(id);
  revalidatePath('/cash-flow');
}

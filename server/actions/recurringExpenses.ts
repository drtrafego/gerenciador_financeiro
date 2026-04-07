'use server';

import { revalidatePath } from 'next/cache';
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} from '@/lib/db/queries';

export async function createRecurringExpenseAction(formData: FormData) {
  await createRecurringExpense({
    name: formData.get('name') as string,
    category: formData.get('category') as string,
    amount: formData.get('amount') as string,
    currency: (formData.get('currency') as string) ?? 'BRL',
    dayOfMonth: Number(formData.get('dayOfMonth') ?? 1),
    active: 'true',
  });
  revalidatePath('/cash-flow');
}

export async function toggleRecurringExpenseAction(id: string, active: boolean) {
  await updateRecurringExpense(id, { active: active ? 'true' : 'false' });
  revalidatePath('/cash-flow');
}

export async function deleteRecurringExpenseAction(id: string) {
  await deleteRecurringExpense(id);
  revalidatePath('/cash-flow');
}

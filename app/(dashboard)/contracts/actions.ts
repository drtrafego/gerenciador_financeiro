'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createContract, updateContract, deleteContract } from '@/lib/db/queries';

const contractSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(['fixed_fee', 'fixed_plus_percentage', 'project']),
  fixedAmount: z.string().transform((v) => v.replace(',', '.')),
  percentage: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  adBudget: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  billingDay: z.string().transform(Number).pipe(z.number().min(1).max(31)).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional().transform((v) => v || null),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  description: z.string().optional(),
  pdfUrl: z.string().url().optional().or(z.literal('')).transform((v) => v || null),
});

export async function createContractAction(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = contractSchema.parse(raw);
  await createContract({
    clientId: parsed.clientId,
    type: parsed.type,
    fixedAmount: parsed.fixedAmount,
    percentage: parsed.percentage ?? null,
    adBudget: parsed.adBudget ?? null,
    currency: parsed.currency,
    billingDay: parsed.billingDay ?? 5,
    startDate: parsed.startDate,
    endDate: parsed.endDate ?? null,
    status: parsed.status,
    description: parsed.description ?? null,
    pdfUrl: parsed.pdfUrl ?? null,
  });
  revalidatePath('/contracts');
  redirect('/contracts');
}

export async function updateContractAction(id: string, formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = contractSchema.parse(raw);
  await updateContract(id, {
    clientId: parsed.clientId,
    type: parsed.type,
    fixedAmount: parsed.fixedAmount,
    percentage: parsed.percentage ?? null,
    adBudget: parsed.adBudget ?? null,
    currency: parsed.currency,
    billingDay: parsed.billingDay ?? 5,
    startDate: parsed.startDate,
    endDate: parsed.endDate ?? null,
    status: parsed.status,
    description: parsed.description ?? null,
    pdfUrl: parsed.pdfUrl ?? null,
  });
  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  redirect('/contracts');
}

export async function deleteContractAction(id: string): Promise<void> {
  await deleteContract(id);
  revalidatePath('/contracts');
  redirect('/contracts');
}

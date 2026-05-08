'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { put } from '@vercel/blob';
import { createContract, updateContract, deleteContract } from '@/lib/db/queries';

const contractSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().optional(),
  type: z.enum(['fixed_fee', 'fixed_plus_percentage', 'project']),
  fixedAmount: z.string().transform((v) => v.replace(',', '.')),
  percentage: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  adBudget: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  billingDay: z.coerce.number().min(1).max(31).default(5),
  startDate: z.string().min(1),
  endDate: z.string().optional().transform((v) => v || null),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  description: z.string().optional(),
  existingPdfUrl: z.string().optional(),
});

async function uploadPdfIfPresent(
  formData: FormData,
  existingUrl?: string | null
): Promise<string | null> {
  const file = formData.get('pdfFile') as File | null;
  if (file && file.size > 0) {
    const { url } = await put(`contracts/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });
    return url;
  }
  return existingUrl ?? null;
}

export async function createContractAction(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => k !== 'pdfFile')
  );
  const parsed = contractSchema.parse(raw);
  const pdfUrl = await uploadPdfIfPresent(formData);
  await createContract({
    clientId: parsed.clientId,
    name: parsed.name ?? null,
    type: parsed.type,
    fixedAmount: parsed.fixedAmount,
    percentage: parsed.percentage ?? null,
    adBudget: parsed.adBudget ?? null,
    currency: parsed.currency,
    billingDay: parsed.billingDay,
    startDate: parsed.startDate,
    endDate: parsed.endDate ?? null,
    status: parsed.status,
    description: parsed.description ?? null,
    pdfUrl,
  });
  revalidatePath('/contracts');
  redirect('/contracts');
}

export async function updateContractAction(id: string, formData: FormData): Promise<void> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => k !== 'pdfFile')
  );
  const parsed = contractSchema.parse(raw);
  const pdfUrl = await uploadPdfIfPresent(formData, parsed.existingPdfUrl);
  await updateContract(id, {
    clientId: parsed.clientId,
    name: parsed.name ?? null,
    type: parsed.type,
    fixedAmount: parsed.fixedAmount,
    percentage: parsed.percentage ?? null,
    adBudget: parsed.adBudget ?? null,
    currency: parsed.currency,
    billingDay: parsed.billingDay,
    startDate: parsed.startDate,
    endDate: parsed.endDate ?? null,
    status: parsed.status,
    description: parsed.description ?? null,
    pdfUrl,
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

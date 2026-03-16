'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, updateClient, deleteClient } from '@/lib/db/queries';

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  contactName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  status: z.enum(['active', 'inactive', 'overdue']).default('active'),
  notes: z.string().optional(),
});

export async function createClientAction(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = clientSchema.parse(raw);
  await createClient({
    name: parsed.name,
    contactName: parsed.contactName ?? null,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    currency: parsed.currency,
    status: parsed.status,
    notes: parsed.notes ?? null,
  });
  revalidatePath('/clients');
  redirect('/clients');
}

export async function updateClientAction(id: string, formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = clientSchema.parse(raw);
  await updateClient(id, {
    name: parsed.name,
    contactName: parsed.contactName ?? null,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    currency: parsed.currency,
    status: parsed.status,
    notes: parsed.notes ?? null,
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(id: string): Promise<void> {
  await deleteClient(id);
  revalidatePath('/clients');
  redirect('/clients');
}

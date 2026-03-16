'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, updateClient, deleteClient } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { contracts } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

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
  const newClient = await createClient({
    name: parsed.name,
    contactName: parsed.contactName ?? null,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    currency: parsed.currency,
    status: parsed.status,
    notes: parsed.notes ?? null,
  });
  revalidatePath('/clients');
  redirect(`/contracts/new?clientId=${newClient.id}`);
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

export async function deleteClientAction(id: string): Promise<{ error: string } | void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contracts)
    .where(eq(contracts.clientId, id));

  if (Number(count) > 0) {
    return {
      error: `Este cliente possui ${count} contrato(s) vinculado(s). Exclua os contratos antes de excluir o cliente.`,
    };
  }

  await deleteClient(id);
  revalidatePath('/clients');
  redirect('/clients');
}

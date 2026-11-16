'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, updateClient, deleteClient, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { contracts, reminders } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { CLIENT_SOURCE_CODES } from '@/lib/clientSources';

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  contactName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  status: z.enum(['active', 'inactive', 'overdue']).default('active'),
  source: z.enum(CLIENT_SOURCE_CODES as [string, ...string[]]).optional().or(z.literal('')),
  isTest: z.preprocess((v) => v === 'on', z.boolean()).optional(),
  notes: z.string().optional(),
});

export async function createClientAction(formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = clientSchema.parse(raw);
  const newClient = await createClient({
    name: parsed.name,
    contactName: parsed.contactName ?? null,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    currency: parsed.currency,
    status: parsed.status,
    source: parsed.source || null,
    isTest: parsed.isTest ?? false,
    notes: parsed.notes ?? null,
  });

  revalidatePath('/clients');
  redirect(`/contracts/new?clientId=${newClient.id}`);
}

export async function updateClientAction(id: string, formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(formData.entries());
  const parsed = clientSchema.parse(raw);
  await updateClient(id, {
    name: parsed.name,
    contactName: parsed.contactName ?? null,
    email: parsed.email || null,
    phone: parsed.phone ?? null,
    currency: parsed.currency,
    status: parsed.status,
    source: parsed.source || null,
    isTest: parsed.isTest ?? false,
    notes: parsed.notes ?? null,
  });

  // Se o cliente foi inativado, cancela qualquer lembrete pendente para ele
  // e pausa os contratos ativos dele para interromper cobranças e ajustar MRR
  if (parsed.status === 'inactive') {
    await db
      .update(reminders)
      .set({ status: 'cancelled', errorMessage: 'Cliente marcado como inativo' })
      .where(and(eq(reminders.clientId, id), eq(reminders.status, 'pending')));

    await db
      .update(contracts)
      .set({ status: 'paused' })
      .where(and(eq(contracts.clientId, id), eq(contracts.status, 'active')));
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  revalidatePath('/contracts');
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(id: string): Promise<{ error: string } | void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
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

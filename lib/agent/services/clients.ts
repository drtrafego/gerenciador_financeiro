import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { getClientById, getClientWithDetails, createClient, updateClient } from '@/lib/db/queries';
import { CLIENT_SOURCE_CODES } from '@/lib/clientSources';
import { notFound } from '../errors';

// id, createdAt e updatedAt nunca são aceitos em body de escrita: como não fazem
// parte destes schemas, o zod (modo padrão "strip") já os descarta se enviados.
const clientCreateSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  status: z.enum(['active', 'inactive', 'overdue']).default('active'),
  source: z.enum(CLIENT_SOURCE_CODES as [string, ...string[]]).nullable().optional(),
  document: z.string().nullable().optional(),
  isTest: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

const clientUpdateSchema = clientCreateSchema.partial();

export async function listClients({ limit, offset }: { limit: number; offset: number }) {
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(clients),
  ]);
  return { data: rows, count: Number(count) };
}

export async function getClientDetail(id: string) {
  const client = await getClientWithDetails(id);
  if (!client) throw notFound('Cliente');
  return client;
}

export async function createClientService(input: unknown) {
  const parsed = clientCreateSchema.parse(input);
  const client = await createClient({
    name: parsed.name,
    contactName: parsed.contactName || null,
    email: parsed.email || null,
    phone: parsed.phone || null,
    currency: parsed.currency,
    status: parsed.status,
    source: parsed.source || null,
    document: parsed.document || null,
    isTest: parsed.isTest ?? false,
    notes: parsed.notes || null,
  });
  revalidatePath('/clients');
  return { client, parsed };
}

export async function updateClientService(id: string, input: unknown) {
  const before = await getClientById(id);
  if (!before) throw notFound('Cliente');

  const parsed = clientUpdateSchema.parse(input);
  const client = await updateClient(id, {
    ...(parsed.name !== undefined && { name: parsed.name }),
    ...(parsed.contactName !== undefined && { contactName: parsed.contactName || null }),
    ...(parsed.email !== undefined && { email: parsed.email || null }),
    ...(parsed.phone !== undefined && { phone: parsed.phone || null }),
    ...(parsed.currency !== undefined && { currency: parsed.currency }),
    ...(parsed.status !== undefined && { status: parsed.status }),
    ...(parsed.source !== undefined && { source: parsed.source || null }),
    ...(parsed.document !== undefined && { document: parsed.document || null }),
    ...(parsed.isTest !== undefined && { isTest: parsed.isTest }),
    ...(parsed.notes !== undefined && { notes: parsed.notes || null }),
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { before, after: client, parsed };
}

export async function deactivateClientService(id: string) {
  const before = await getClientById(id);
  if (!before) throw notFound('Cliente');

  const client = await updateClient(id, { status: 'inactive' });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { before, after: client };
}

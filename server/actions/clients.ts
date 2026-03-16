"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";

const clientSchema = z.object({
  name: z.string().min(2),
  contact_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  currency: z.enum(["BRL", "USD", "ARS"]),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

export async function createClient(data: unknown): Promise<void> {
  const parsed = clientSchema.parse(data);
  await db.insert(clients).values({
    name: parsed.name,
    contactName: parsed.contact_name || null,
    email: parsed.email || null,
    phone: parsed.phone || null,
    currency: parsed.currency,
    status: parsed.status,
    notes: parsed.notes || null,
  });
  revalidatePath("/clients");
}

export async function updateClient(id: string, data: unknown): Promise<void> {
  const parsed = clientSchema.parse(data);
  await db
    .update(clients)
    .set({
      name: parsed.name,
      contactName: parsed.contact_name || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      currency: parsed.currency,
      status: parsed.status,
      notes: parsed.notes || null,
    })
    .where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function deactivateClient(id: string): Promise<void> {
  await db.update(clients).set({ status: "inactive" }).where(eq(clients.id, id));
  revalidatePath("/clients");
}

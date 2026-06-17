"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/db/queries";

async function upsertSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  if (existing.length > 0) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value });
  }
}

export async function updateDisplayCurrency(currency: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await upsertSetting("display_currency", currency);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/cash-flow");
  revalidatePath("/invoices");
}

export async function updateAgencySettings({
  name,
  email,
  cnpj,
  address,
  city,
}: {
  name: string;
  email: string;
  cnpj?: string;
  address?: string;
  city?: string;
}): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const ops = [
    upsertSetting("agency_name", name),
    upsertSetting("agency_email", email),
  ];
  if (cnpj !== undefined) ops.push(upsertSetting("agency_cnpj", cnpj));
  if (address !== undefined) ops.push(upsertSetting("agency_address", address));
  if (city !== undefined) ops.push(upsertSetting("agency_city", city));
  await Promise.all(ops);
  revalidatePath("/settings");
  revalidatePath("/invoice");
}

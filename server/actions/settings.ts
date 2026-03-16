"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  await upsertSetting("display_currency", currency);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/cash-flow");
  revalidatePath("/invoices");
}

export async function updateAgencySettings({
  name,
  email,
}: {
  name: string;
  email: string;
}): Promise<void> {
  await Promise.all([
    upsertSetting("agency_name", name),
    upsertSetting("agency_email", email),
  ]);
  revalidatePath("/settings");
}

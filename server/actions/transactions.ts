"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const transactionSchema = z.object({
  type:              z.enum(["income", "expense"]),
  category:         z.string().min(1),
  description:      z.string().min(1),
  amount:           z.number().positive(),
  currency:         z.enum(["BRL", "USD", "ARS"]),
  date:             z.string(),
  isRecurring:      z.boolean().optional().default(false),
  recurringEndsAt:  z.string().nullable().optional(),
});

export async function createTransaction(data: unknown): Promise<void> {
  const parsed = transactionSchema.parse(data);
  await db.insert(transactions).values({
    type:             parsed.type,
    category:         parsed.category,
    description:      parsed.description,
    amount:           String(parsed.amount),
    currency:         parsed.currency,
    date:             parsed.date,
    isRecurring:      parsed.isRecurring ? 'true' : 'false',
    recurringActive:  'true',
    recurringEndsAt:  parsed.recurringEndsAt ?? null,
  });
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function updateTransaction(id: string, data: unknown): Promise<void> {
  const parsed = transactionSchema.parse(data);
  await db.update(transactions).set({
    type:             parsed.type,
    category:         parsed.category,
    description:      parsed.description,
    amount:           String(parsed.amount),
    currency:         parsed.currency,
    date:             parsed.date,
    isRecurring:      parsed.isRecurring ? 'true' : 'false',
    recurringActive:  'true',
    recurringEndsAt:  parsed.recurringEndsAt ?? null,
  }).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function deactivateRecurring(id: string): Promise<void> {
  await db.update(transactions).set({ recurringActive: 'false' }).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/transactions");
}

export async function deleteTransactionById(id: string): Promise<void> {
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

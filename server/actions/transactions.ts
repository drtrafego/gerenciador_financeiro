"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { z } from "zod";

const transactionSchema = z.object({
  type:        z.enum(["income", "expense"]),
  category:    z.string().min(1),
  description: z.string().min(1),
  amount:      z.number().positive(),
  currency:    z.enum(["BRL", "USD", "ARS"]),
  date:        z.string(),
});

export async function createTransaction(data: unknown): Promise<void> {
  const parsed = transactionSchema.parse(data);
  await db.insert(transactions).values({
    type:        parsed.type,
    category:    parsed.category,
    description: parsed.description,
    amount:      String(parsed.amount),
    currency:    parsed.currency,
    date:        parsed.date,
  });
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
}

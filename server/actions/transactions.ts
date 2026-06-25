"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "@/lib/db/queries";

const transactionSchema = z.object({
  type:              z.enum(["income", "expense"]),
  category:         z.string().min(1),
  description:      z.string().min(1),
  amount:           z.number().positive(),       // valor efetivo (com IOF, se houver)
  baseAmount:       z.number().positive().nullable().optional(), // valor original digitado
  iof:              z.boolean().optional().default(false),
  currency:         z.enum(["BRL", "USD", "ARS"]),
  date:             z.string(),
  isRecurring:      z.boolean().optional().default(false),
  recurringEndsAt:  z.string().nullable().optional(),
  clientId:         z.string().uuid().nullable().optional(),
  installments:     z.number().int().min(1).max(60).optional().default(1),
});

// Soma meses a uma data 'YYYY-MM-DD', preservando o dia (com clamp ao fim do mês).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y!, m! - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d!, lastDay);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function createTransaction(data: unknown): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const parsed = transactionSchema.parse(data);
  const n = parsed.installments ?? 1;

  if (n <= 1) {
    await db.insert(transactions).values({
      type:             parsed.type,
      category:         parsed.category,
      description:      parsed.description,
      amount:           String(parsed.amount),
      baseAmount:       parsed.baseAmount != null ? String(parsed.baseAmount) : null,
      iof:              parsed.iof,
      currency:         parsed.currency,
      date:             parsed.date,
      clientId:         parsed.clientId ?? null,
      isRecurring:      parsed.isRecurring ? 'true' : 'false',
      recurringActive:  'true',
      recurringEndsAt:  parsed.recurringEndsAt ?? null,
    });
  } else {
    // Parcelado: divide o valor TOTAL em n meses (última parcela absorve arredondamento). Sem recorrência.
    const amtCents = Math.round(parsed.amount * 100);
    const amtBase = Math.floor(amtCents / n);
    const amtRem = amtCents - amtBase * n;
    const baseCents = parsed.baseAmount != null ? Math.round(parsed.baseAmount * 100) : null;
    const baseBase = baseCents != null ? Math.floor(baseCents / n) : null;
    const baseRem = baseCents != null ? baseCents - baseBase! * n : 0;
    for (let i = 0; i < n; i++) {
      const a = (amtBase + (i === n - 1 ? amtRem : 0)) / 100;
      const b = baseCents != null ? (baseBase! + (i === n - 1 ? baseRem : 0)) / 100 : null;
      await db.insert(transactions).values({
        type:             parsed.type,
        category:         parsed.category,
        description:      `${parsed.description} (${i + 1}/${n})`,
        amount:           String(a),
        baseAmount:       b != null ? String(b) : null,
        iof:              parsed.iof,
        currency:         parsed.currency,
        date:             addMonths(parsed.date, i),
        clientId:         parsed.clientId ?? null,
        isRecurring:      'false',
        recurringActive:  'true',
        recurringEndsAt:  null,
      });
    }
  }

  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function updateTransaction(id: string, data: unknown): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const parsed = transactionSchema.parse(data);
  await db.update(transactions).set({
    type:             parsed.type,
    category:         parsed.category,
    description:      parsed.description,
    amount:           String(parsed.amount),
    baseAmount:       parsed.baseAmount != null ? String(parsed.baseAmount) : null,
    iof:              parsed.iof,
    currency:         parsed.currency,
    date:             parsed.date,
    clientId:         parsed.clientId ?? null,
    isRecurring:      parsed.isRecurring ? 'true' : 'false',
    recurringActive:  'true',
    recurringEndsAt:  parsed.recurringEndsAt ?? null,
  }).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function deactivateRecurring(id: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.update(transactions).set({ recurringActive: 'false' }).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/transactions");
}

export async function deleteTransactionById(id: string): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

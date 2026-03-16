"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { invoices, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const invoiceSchema = z.object({
  clientId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  type: z.enum(["monthly", "project", "proposal"]),
  amount: z.number().positive(),
  currency: z.enum(["BRL", "USD", "ARS"]),
  dueDate: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `INV-${year}-${rand}`;
}

export async function createInvoice(data: unknown): Promise<void> {
  const parsed = invoiceSchema.parse(data);
  await db.insert(invoices).values({
    invoiceNumber: generateInvoiceNumber(),
    clientId: parsed.clientId,
    contractId: parsed.contractId ?? null,
    type: parsed.type,
    amount: String(parsed.amount),
    currency: parsed.currency,
    status: "draft",
    dueDate: parsed.dueDate,
    description: parsed.description ?? null,
    notes: parsed.notes ?? null,
  });
  revalidatePath("/invoices");
}

export async function markInvoicePaid(id: string): Promise<void> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!invoice) return;

  await db
    .update(invoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(invoices.id, id));

  // Criar transação de receita automaticamente
  await db.insert(transactions).values({
    type: "income",
    category: "invoice",
    description: `Fatura ${invoice.invoiceNumber} paga`,
    amount: invoice.amount,
    currency: invoice.currency ?? "BRL",
    date: new Date().toISOString().split("T")[0],
    invoiceId: id,
    clientId: invoice.clientId ?? null,
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/cash-flow");
}

export async function updateInvoiceStatus(id: string, status: string): Promise<void> {
  await db.update(invoices).set({ status }).where(eq(invoices.id, id));
  revalidatePath("/invoices");
}

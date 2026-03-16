export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { invoices, clients } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function InvoicesPage() {
  const data = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoiceNumber,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      due_date: invoices.dueDate,
      type: invoices.type,
      client_name: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-200 hidden sm:block">Faturas & Propostas</h2>
        <Link
          href="/invoices/new"
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nova Fatura</span>
          <span className="sm:hidden">Nova</span>
        </Link>
      </div>
      <InvoicesTable invoices={data} />
    </div>
  );
}

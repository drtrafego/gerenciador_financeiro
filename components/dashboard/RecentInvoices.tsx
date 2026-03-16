import Link from "next/link";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";

const STATUS_STYLES: Record<string, string> = {
  draft:     "text-zinc-400 bg-zinc-800",
  sent:      "text-blue-400 bg-blue-500/10",
  paid:      "text-green-400 bg-green-500/10",
  overdue:   "text-red-400 bg-red-500/10",
  cancelled: "text-zinc-600 bg-zinc-800",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", sent: "Enviado", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado",
};

interface Props {
  invoices: {
    id: string;
    invoiceNumber?: string | null;
    amount?: string | null;
    currency?: string | null;
    status?: string | null;
    dueDate?: string | null;
  }[];
}

export default function RecentInvoices({ invoices }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-200">Faturas Recentes</p>
        <Link href="/invoices" className="text-xs text-indigo-400 hover:text-indigo-300">
          Ver todas →
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-6">Nenhuma fatura ainda</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0 hover:opacity-80 transition-opacity">
              <div>
                <p className="text-xs font-mono text-indigo-400">{inv.invoiceNumber ?? "—"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Vence {inv.dueDate ? new Date(inv.dueDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-200">
                  {formatCurrency(parseFloat(inv.amount ?? "0"), (inv.currency as Currency) ?? "BRL")}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[inv.status ?? "draft"]}`}>
                  {STATUS_LABELS[inv.status ?? "draft"]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

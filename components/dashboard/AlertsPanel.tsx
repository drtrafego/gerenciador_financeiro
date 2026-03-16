import Link from "next/link";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import { AlertCircle, Clock } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber?: string | null;
  amount?: string | null;
  currency?: string | null;
  dueDate?: string | null;
}

interface Props {
  overdue: Invoice[];
  upcoming: Invoice[];
}

export default function AlertsPanel({ overdue, upcoming }: Props) {
  const hasAlerts = overdue.length > 0 || upcoming.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-4">Alertas</p>

      {!hasAlerts && (
        <p className="text-sm text-zinc-600 text-center py-6">Nenhum alerta no momento</p>
      )}

      {overdue.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-2">
            <AlertCircle size={12} />
            {overdue.length} fatura(s) vencida(s)
          </div>
          <div className="flex flex-col gap-1.5">
            {overdue.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2 hover:border-red-500/20 transition-colors">
                <span className="text-xs font-mono text-red-300">{inv.invoiceNumber ?? "—"}</span>
                <span className="text-xs font-semibold text-red-400">
                  {formatCurrency(parseFloat(inv.amount ?? "0"), (inv.currency as Currency) ?? "BRL")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-400 mb-2">
            <Clock size={12} />
            {upcoming.length} fatura(s) vencendo em 7 dias
          </div>
          <div className="flex flex-col gap-1.5">
            {upcoming.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg bg-yellow-500/5 border border-yellow-500/10 px-3 py-2 hover:border-yellow-500/20 transition-colors">
                <div>
                  <span className="text-xs font-mono text-yellow-300">{inv.invoiceNumber ?? "—"}</span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Vence {inv.dueDate ? new Date(inv.dueDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-yellow-400">
                  {formatCurrency(parseFloat(inv.amount ?? "0"), (inv.currency as Currency) ?? "BRL")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

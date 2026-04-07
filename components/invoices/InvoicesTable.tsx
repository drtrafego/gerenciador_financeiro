"use client";

import { useState } from "react";
import { MoreHorizontal, Eye } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/currency/format";
import Link from "next/link";
import { markInvoicePaid } from "@/server/actions/invoices";
import { useRouter } from "next/navigation";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import type { Currency } from "@/lib/currency/format";

const HIDDEN = "••••••";

const STATUSES = ["all", "draft", "sent", "paid", "overdue", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  all: "Todas",
  draft: "Rascunho",
  sent: "Enviado",
  paid: "Pago",
  overdue: "Em Atraso",
  cancelled: "Cancelado",
};

export default function InvoicesTable({ invoices }: { invoices: any[] }) {
  const [filter, setFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const router = useRouter();
  const { hidden } = useValuesVisibility();

  const fmtAmount = (amount: number, currency: string = "BRL") =>
    hidden ? HIDDEN : formatCurrency(amount, currency as Currency);

  const filtered =
    filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const handleMarkPaid = async (id: string) => {
    await markInvoicePaid(id);
    router.refresh();
    setOpenMenu(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status Filter */}
      <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 overflow-x-auto">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${filter === s ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-8">Nenhuma fatura encontrada</p>
        )}
        {filtered.map((inv) => (
          <div key={inv.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-mono text-indigo-400">{inv.invoice_number}</p>
                <p className="text-sm font-medium text-zinc-200 mt-0.5">{inv.client_name}</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-base font-bold text-zinc-100">
                {fmtAmount(Number(inv.amount), inv.currency ?? "BRL")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  Vence:{" "}
                  {inv.due_date
                    ? new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </span>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <Eye size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Nº Fatura", "Cliente", "Tipo", "Valor", "Vencimento", "Status", "Ações"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-zinc-600">
                  Nenhuma fatura encontrada
                </td>
              </tr>
            )}
            {filtered.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm font-mono text-indigo-400">
                  {inv.invoice_number}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-200">{inv.client_name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 capitalize">
                  {inv.type}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-zinc-200">
                  {fmtAmount(Number(inv.amount), inv.currency ?? "BRL")}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-400">
                  {inv.due_date
                    ? new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === inv.id ? null : inv.id)}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-700"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenu === inv.id && (
                      <div className="absolute right-0 top-8 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 py-1 w-40">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Ver detalhes
                        </Link>
                        {inv.status !== "paid" && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            className="block w-full text-left px-3 py-2 text-xs text-green-400 hover:bg-zinc-700"
                          >
                            Marcar como pago
                          </button>
                        )}
                        <Link
                          href={`/invoice/${inv.id}`}
                          target="_blank"
                          className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Ver fatura pública
                        </Link>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

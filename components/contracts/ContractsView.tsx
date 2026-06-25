"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import ContractsTable from "./ContractsTable";
import TransactionModal from "@/components/cashflow/TransactionModal";

type TxRow = {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: string | null;
  baseAmount?: string | null;
  iof?: boolean | null;
  currency: string | null;
  date: string;
  clientId?: string | null;
  isRecurring: string | null;
  recurringActive: string | null;
  recurringEndsAt: string | null;
};

interface Props {
  contractRows: any[];
  projects: { t: TxRow; clientName: string | null }[];
  clients: { id: string; name: string }[];
}

const HIDDEN = "••••••";

export default function ContractsView({ contractRows, projects, clients }: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const { hidden } = useValuesVisibility();

  const fmt = (amount: string | null, currency: string | null) =>
    hidden ? HIDDEN : formatCurrency(parseFloat(amount ?? "0"), (currency as Currency) ?? "BRL");

  return (
    <div className="space-y-8">
      {/* Botões */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Link
          href="/contracts/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Link>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Receita
        </button>
      </div>

      {/* Contratos */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400">Contratos ({contractRows.length})</h2>
        {contractRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-center">
            <FileText className="h-9 w-9 text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">Nenhum contrato cadastrado</p>
          </div>
        ) : (
          <ContractsTable rows={contractRows} />
        )}
      </div>

      {/* Receitas avulsas */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-400">Receitas avulsas ({projects.length})</h2>
          <p className="text-xs text-zinc-500">Mentoria, consultoria, comissão e valores únicos ou parcelados. Entram no fluxo de caixa e na ficha do cliente.</p>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-12 text-center">
            <p className="text-zinc-500 text-sm">Nenhuma receita avulsa lançada</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Receita
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Descrição", "Categoria", "Cliente", "Data", "Valor"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {projects.map(({ t, clientName }) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-zinc-200">{t.description}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{t.category}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap">
                      {fmt(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <TransactionModal
          onClose={() => {
            setShowNew(false);
            router.refresh();
          }}
          clients={clients}
          defaultType="income"
        />
      )}
      {editing && (
        <TransactionModal
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
          transaction={editing}
          clients={clients}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [tab, setTab] = useState<"contratos" | "projetos">("contratos");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const { hidden } = useValuesVisibility();

  const fmt = (amount: string | null, currency: string | null) =>
    hidden ? HIDDEN : formatCurrency(parseFloat(amount ?? "0"), (currency as Currency) ?? "BRL");

  const tabBtn = (key: "contratos" | "projetos", label: string) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
        tab === key ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30" : "text-zinc-400 hover:bg-zinc-800"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          {tabBtn("contratos", "Contratos")}
          {tabBtn("projetos", "Projetos")}
        </div>

        {tab === "contratos" ? (
          <Link
            href="/contracts/new"
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Link>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Projeto
          </button>
        )}
      </div>

      {tab === "contratos" ? (
        contractRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
            <FileText className="h-10 w-10 text-zinc-600 mb-4" />
            <p className="text-zinc-400 font-medium">Nenhum contrato cadastrado</p>
          </div>
        ) : (
          <ContractsTable rows={contractRows} />
        )
      ) : (
        <div>
          <p className="text-sm text-zinc-500 mb-3">
            Serviços pontuais, mentorias, consultorias, comissões e parcelas. Ficam vinculados ao cliente e entram no fluxo de caixa.
          </p>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
              <FileText className="h-10 w-10 text-zinc-600 mb-4" />
              <p className="text-zinc-400 font-medium">Nenhum projeto lançado</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Novo Projeto
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
      )}

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

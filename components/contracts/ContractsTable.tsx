"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency/format";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import type { Currency } from "@/lib/currency/format";
import {
  effectiveContractStatus,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_STYLES,
} from "@/lib/contracts";

const HIDDEN = "••••••";

const typeLabels: Record<string, string> = {
  fixed_fee: "Fee Fixo",
  fixed_plus_percentage: "Fixo + %",
  project: "Projeto",
};

type ContractRow = {
  contract: {
    id: string;
    name: string | null;
    type: string;
    fixedAmount: string | null;
    percentage: string | null;
    currency: string | null;
    billingDay: number | null;
    status: string | null;
    endDate: string | null;
  };
  clientName: string | null;
};

export default function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const { hidden } = useValuesVisibility();

  const fmtAmount = (amount: string | null, currency: string | null) =>
    hidden
      ? HIDDEN
      : formatCurrency(parseFloat(amount ?? "0"), (currency as Currency) ?? "BRL");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Cliente</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Serviço</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Tipo</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Valor Fixo</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Venc.</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map(({ contract, clientName }) => {
            const eff = effectiveContractStatus(contract.status, contract.endDate);
            return (
            <tr key={contract.id} className="hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-white">{clientName ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-300">
                {contract.name ?? <span className="text-zinc-600">—</span>}
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {typeLabels[contract.type] ?? contract.type}
              </td>
              <td className="px-4 py-3 text-white">
                {fmtAmount(contract.fixedAmount, contract.currency)}
                {contract.type === "fixed_plus_percentage" && contract.percentage && (
                  <span className="ml-1 text-zinc-500">+ {contract.percentage}%</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-400">Dia {contract.billingDay}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    CONTRACT_STATUS_STYLES[eff]
                  )}
                >
                  {CONTRACT_STATUS_LABELS[eff]}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Ver →
                </Link>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { convertAmount, formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import { sourceLabel } from "@/lib/clientSources";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

interface Row {
  code: string;
  mrr: number;   // em BRL
  total: number; // em BRL
  clients: number;
}

interface Props {
  rows: Row[];
  displayCurrency: Currency;
  rate: { usd_brl: number; usd_ars: number };
}

export default function SourceBreakdown({ rows, displayCurrency, rate }: Props) {
  const { hidden } = useValuesVisibility();
  const fmt = (brl: number) =>
    hidden ? "••••••" : formatCurrency(convertAmount(brl, "BRL", displayCurrency, rate), displayCurrency);

  const hasData = rows.some((r) => r.mrr > 0 || r.total > 0 || r.clients > 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-200">Receita por Origem</p>
        <span className="text-xs text-zinc-500">Canal de aquisição</span>
      </div>

      {!hasData ? (
        <p className="text-sm text-zinc-600 text-center py-6">
          Defina a origem dos clientes para ver o ranking por canal.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Canal</th>
                <th className="text-right py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">MRR / mês</th>
                <th className="text-right py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Entradas no período</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-zinc-800/50 last:border-0">
                  <td className="py-2.5">
                    <p className="text-sm font-medium text-zinc-200">{sourceLabel(r.code === "none" ? null : r.code)}</p>
                    <p className="text-xs text-zinc-500">
                      {r.clients} {r.clients === 1 ? "cliente" : "clientes"}
                    </p>
                  </td>
                  <td className="py-2.5 text-right text-sm font-semibold text-zinc-200">{fmt(r.mrr)}</td>
                  <td className="py-2.5 text-right text-sm font-semibold text-green-400">{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

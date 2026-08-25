"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";

// Mesma regra do MRRChart: os valores já chegam convertidos, na moeda de
// `currency` e pela cotação da época de cada mês. Nada de converter aqui.

interface Props {
  data: { month: string; income: number | string; expense: number | string }[];
  currency: Currency;
}

export default function RevenueChart({ data, currency }: Props) {
  const normalized = data.map((d) => ({
    month: d.month,
    Receitas: Number(d.income),
    Despesas: Number(d.expense),
  }));

  const eixo = new Intl.NumberFormat(
    currency === "USD" ? "en-US" : currency === "ARS" ? "es-AR" : "pt-BR",
    { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 transition-colors duration-200 hover:border-zinc-700">
      <p className="text-sm font-semibold text-zinc-200 mb-4">Receitas vs Despesas (6 meses)</p>
      {normalized.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={normalized} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={72}
              tickFormatter={(v) => eixo.format(Number(v))} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
              formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
              cursor={{ fill: "#ffffff08" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
            <Bar dataKey="Receitas" fill="#6366f1" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

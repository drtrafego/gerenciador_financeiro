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

interface Props {
  data: { month: string; income: number | string; expense: number | string }[];
}

export default function RevenueChart({ data }: Props) {
  const normalized = data.map((d) => ({
    month: d.month,
    Receitas: Number(d.income),
    Despesas: Number(d.expense),
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-4">Receitas vs Despesas (6 meses)</p>
      {normalized.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={normalized} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
              formatter={(value) => [`R$ ${Number(value).toLocaleString("pt-BR")}`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
            <Bar dataKey="Receitas" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

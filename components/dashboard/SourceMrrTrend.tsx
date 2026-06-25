"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

interface Props {
  data: Record<string, number | string>[];
  series: { key: string; color: string }[];
}

export default function SourceMrrTrend({ data, series }: Props) {
  const { hidden } = useValuesVisibility();
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-4">Evolução do MRR por Origem (6 meses)</p>
      {series.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50}
              tickFormatter={(v) => (hidden ? "" : `${(Number(v) / 1000).toFixed(0)}k`)} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
              formatter={(value, name) => [hidden ? "••••••" : `R$ ${Number(value).toLocaleString("pt-BR")}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ fill: s.color, r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

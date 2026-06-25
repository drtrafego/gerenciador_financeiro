"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { sourceLabel, sourceColor } from "@/lib/clientSources";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

interface Props {
  rows: { code: string; mrr: number }[];
}

export default function SourceMrrBar({ rows }: Props) {
  const { hidden } = useValuesVisibility();
  const data = rows.map((r) => {
    const code = r.code === "none" ? null : r.code;
    return { canal: sourceLabel(code), MRR: Number(r.mrr), color: sourceColor(code) };
  });

  const hasData = data.some((d) => d.MRR > 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-4">MRR por Origem</p>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="canal" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={50}
              tickFormatter={(v) => (hidden ? "" : `${(v / 1000).toFixed(0)}k`)} />
            <Tooltip
              cursor={{ fill: "#27272a55" }}
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
              formatter={(value) => [hidden ? "••••••" : `R$ ${Number(value).toLocaleString("pt-BR")}`, "MRR/mês"]}
            />
            <Bar dataKey="MRR" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.canal} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

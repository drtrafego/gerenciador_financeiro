'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

interface CashFlowChartProps {
  data: CashFlowData[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Fluxo de Caixa — últimos 6 meses</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: '#e4e4e7' }}
            formatter={(value) =>
              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#71717a' }}
            formatter={(v) => (v === 'income' ? 'Receitas' : 'Despesas')}
          />
          <Bar dataKey="income" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

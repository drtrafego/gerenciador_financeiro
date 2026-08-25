"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";

// Atenção ao passar valores: os pontos do gráfico já chegam convertidos, sempre
// em reais e pela cotação da ÉPOCA de cada mês. Por isso o componente recebe a
// moeda em `currency` e nunca a taxa: chamar convertAmount aqui seria conversão
// dupla, e ainda pela cotação de hoje, que reescreveria o passado. Quando a
// moeda de exibição do painel é outra, o cabeçalho avisa em qual moeda o gráfico
// está, senão os cards mostrariam dólar e o gráfico real sem nenhum aviso.

interface Props {
  data: { month: string; income: number | string; expense: number | string; mrr?: number | string }[];
  currency: Currency;
  displayCurrency: Currency;
}

export default function MRRChart({ data, currency, displayCurrency }: Props) {
  const normalized = data.map((d) => ({
    month: d.month,
    MRR: Number(d.mrr ?? d.income),
    Saldo: Number(d.income) - Number(d.expense),
  }));

  // Eixo compacto com símbolo e sinal. O formato antigo, `${(v/1000).toFixed(0)}k`,
  // truncava (18.850 virava "19k") e escondia o negativo.
  const eixo = new Intl.NumberFormat(
    currency === "USD" ? "en-US" : currency === "ARS" ? "es-AR" : "pt-BR",
    { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 transition-colors duration-200 hover:border-zinc-700">
      {/* Legenda escrita fora do ResponsiveContainer: não custa altura do gráfico,
          e explica o que cada linha significa. O <Legend> do recharts devolveria
          só as duas palavras "MRR" e "Saldo", e ainda comeria altura. */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-200">Evolução do MRR</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: "#6366f1" }} />
              MRR
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
              Saldo
            </span>
            {displayCurrency !== currency && (
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
                valores em {getCurrencySymbol(currency)}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          MRR é o quanto está contratado no mês. Saldo é entradas menos saídas.
        </p>
      </div>
      {normalized.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-600">
          Sem dados disponíveis
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={normalized} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            {/* O domínio nunca corta o zero: o único mês negativo da série é o dado
                mais importante do gráfico, e forçar o eixo a começar em zero o apagaria
                em troca de pouco ganho de resolução. */}
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={72}
              domain={[(min: number) => Math.min(0, min) * 1.15, "auto"]}
              tickFormatter={(v) => eixo.format(Number(v))} />
            <ReferenceLine y={0} stroke="#3f3f46" />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
              formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
              cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
            />
            <Line dataKey="MRR" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} animationDuration={900} animationEasing="ease-out" />
            <Line dataKey="Saldo" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3 }} strokeDasharray="4 4" animationDuration={900} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

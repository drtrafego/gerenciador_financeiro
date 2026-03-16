"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatCurrency, convertAmount } from "@/lib/currency/format";
import MetricCard from "@/components/dashboard/MetricCard";
import TransactionModal from "@/components/cashflow/TransactionModal";
import type { Currency } from "@/lib/currency/format";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CashFlowClient({
  transactions,
  rate,
  displayCurrency,
  month,
  year,
}: {
  transactions: any[];
  rate: { usd_brl: number; usd_ars: number };
  displayCurrency: Currency;
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const toDisplay = (amount: number, currency: string) =>
    convertAmount(amount, currency as Currency, displayCurrency, rate);

  const totalIn = transactions
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + toDisplay(Number(t.amount), t.currency ?? "BRL"), 0);
  const totalOut = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + toDisplay(Number(t.amount), t.currency ?? "BRL"), 0);
  const balance = totalIn - totalOut;

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    router.push(`/cash-flow?month=${d.getMonth() + 1}&year=${d.getFullYear()}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    router.push(`/cash-flow?month=${d.getMonth() + 1}&year=${d.getFullYear()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Month Nav */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="text-zinc-400 hover:text-zinc-200 px-3 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-zinc-200 min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="text-zinc-400 hover:text-zinc-200 px-3 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Novo Lançamento</span>
          <span className="sm:hidden">Lançar</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Entradas" value={totalIn} currency={displayCurrency} icon="trending-up" color="green" />
        <MetricCard label="Saídas" value={totalOut} currency={displayCurrency} icon="trending-down" color="red" />
        <MetricCard
          label="Saldo do Mês"
          value={balance}
          currency={displayCurrency}
          icon="bar-chart"
          color={balance >= 0 ? "indigo" : "red"}
        />
        <MetricCard
          label="Transações"
          value={transactions.length}
          raw
          icon="dollar"
          color="indigo"
          sub="no mês"
        />
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {transactions.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-8">
            Nenhuma transação neste mês
          </p>
        )}
        {transactions.map((t) => (
          <div
            key={t.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200">{t.description}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t.category} · {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            </div>
            <span
              className={`text-sm font-bold ${t.type === "income" ? "text-green-400" : "text-red-400"}`}
            >
              {t.type === "income" ? "+" : "-"}
              {formatCurrency(Number(t.amount), (t.currency as Currency) ?? "BRL")}
            </span>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Data", "Descrição", "Categoria", "Tipo", "Valor"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-zinc-600">
                  Nenhuma transação neste mês
                </td>
              </tr>
            )}
            {transactions.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">
                  {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-200">{t.description}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    {t.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium ${t.type === "income" ? "text-green-400" : "text-red-400"}`}
                  >
                    {t.type === "income" ? "↑ Entrada" : "↓ Saída"}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap ${t.type === "income" ? "text-green-400" : "text-red-400"}`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(Number(t.amount), (t.currency as Currency) ?? "BRL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

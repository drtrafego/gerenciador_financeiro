"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, RefreshCw, Eye, EyeOff } from "lucide-react";
import { formatCurrency, convertAmount } from "@/lib/currency/format";
import MetricCard from "@/components/dashboard/MetricCard";
import TransactionModal from "@/components/cashflow/TransactionModal";
import RecurringExpensesModal from "@/components/cashflow/RecurringExpensesModal";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import type { Currency } from "@/lib/currency/format";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ContractIncome = {
  id: string;
  type: "income";
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  isContract: true;
};

type RecurringItem = {
  id: string;
  type: "expense";
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  isRecurring: true;
};

type AnyExpense = {
  id: string;
  name: string;
  category: string;
  amount: string;
  currency: string | null;
  dayOfMonth: number | null;
  active: string | null;
};

const HIDDEN = "••••••";

export default function CashFlowClient({
  transactions,
  contractIncomes = [],
  recurringItems = [],
  allRecurringExpenses = [],
  rate,
  displayCurrency,
  month,
  year,
}: {
  transactions: any[];
  contractIncomes?: ContractIncome[];
  recurringItems?: RecurringItem[];
  allRecurringExpenses?: AnyExpense[];
  rate: { usd_brl: number; usd_ars: number };
  displayCurrency: Currency;
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const { hidden: valuesHidden, toggle: toggleValues } = useValuesVisibility();

  const toDisplay = (amount: number, currency: string) =>
    convertAmount(amount, currency as Currency, displayCurrency, rate);

  const allEntries = [
    ...contractIncomes,
    ...recurringItems,
    ...transactions,
  ].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

  const contractTotal = contractIncomes.reduce(
    (a, c) => a + toDisplay(Number(c.amount), c.currency ?? "BRL"), 0
  );
  const txIncomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + toDisplay(Number(t.amount), t.currency ?? "BRL"), 0);
  const totalIn = contractTotal + txIncomeTotal;

  const recurringTotal = recurringItems.reduce(
    (a, r) => a + toDisplay(Number(r.amount), r.currency ?? "BRL"), 0
  );
  const txExpenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + toDisplay(Number(t.amount), t.currency ?? "BRL"), 0);
  const totalOut = recurringTotal + txExpenseTotal;

  const balance = totalIn - totalOut;

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    router.push(`/cash-flow?month=${d.getMonth() + 1}&year=${d.getFullYear()}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    router.push(`/cash-flow?month=${d.getMonth() + 1}&year=${d.getFullYear()}`);
  };

  const entryCount = allEntries.length;

  const fmtValue = (value: number, currency: Currency) =>
    valuesHidden ? HIDDEN : formatCurrency(value, currency);

  const fmtRaw = (amount: number, currency: string) =>
    valuesHidden ? HIDDEN : formatCurrency(Number(amount), currency as Currency);

  return (
    <div className="flex flex-col gap-4">
      {/* Month Nav */}
      <div className="flex items-center gap-2 flex-wrap">
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

        {/* Botão ocultar valores */}
        <button
          onClick={toggleValues}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          title={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
        >
          {valuesHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">{valuesHidden ? "Mostrar" : "Ocultar"}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowRecurring(true)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Recorrentes</span>
            {allRecurringExpenses.filter((r) => r.active === 'true').length > 0 && (
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-1.5 py-0.5 rounded-full">
                {allRecurringExpenses.filter((r) => r.active === 'true').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Lançar</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Entradas" value={totalIn} currency={displayCurrency} icon="trending-up" color="green" hidden={valuesHidden} />
        <MetricCard label="Saídas" value={totalOut} currency={displayCurrency} icon="trending-down" color="red" hidden={valuesHidden} />
        <MetricCard
          label="Saldo do Mês"
          value={balance}
          currency={displayCurrency}
          icon="bar-chart"
          color={balance >= 0 ? "indigo" : "red"}
          hidden={valuesHidden}
        />
        <MetricCard
          label="Lançamentos"
          value={entryCount}
          raw
          icon="dollar"
          color="indigo"
          sub={`${contractIncomes.length} contrato(s) · ${recurringItems.length} recorrente(s)`}
        />
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {allEntries.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-8">
            Nenhum lançamento neste mês
          </p>
        )}
        {allEntries.map((t) => (
          <div
            key={t.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-start gap-2 min-w-0">
              {(t as any).isContract && (
                <FileText size={14} className="text-indigo-400 mt-0.5 shrink-0" />
              )}
              {(t as any).isRecurring && (
                <RefreshCw size={14} className="text-orange-400 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{t.description}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t.category} · {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="ml-3 shrink-0 text-right">
              <span className={`text-sm font-bold ${t.type === "income" ? "text-green-400" : "text-red-400"}`}>
                {t.type === "income" ? "+" : "-"}
                {fmtValue(toDisplay(Number(t.amount), t.currency ?? "BRL"), displayCurrency)}
              </span>
              {!valuesHidden && (t.currency ?? "BRL") !== displayCurrency && (
                <p className="text-xs text-zinc-600 mt-0.5">
                  {fmtRaw(Number(t.amount), t.currency ?? "BRL")}
                </p>
              )}
            </div>
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
            {allEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-zinc-600">
                  Nenhum lançamento neste mês
                </td>
              </tr>
            )}
            {allEntries.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">
                  {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-200">
                  <div className="flex items-center gap-1.5">
                    {(t as any).isContract && (
                      <FileText size={12} className="text-indigo-400 shrink-0" />
                    )}
                    {(t as any).isRecurring && (
                      <RefreshCw size={12} className="text-orange-400 shrink-0" />
                    )}
                    {t.description}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    (t as any).isContract
                      ? "bg-indigo-500/10 text-indigo-400"
                      : (t as any).isRecurring
                      ? "bg-orange-500/10 text-orange-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}>
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
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`font-semibold ${t.type === "income" ? "text-green-400" : "text-red-400"}`}>
                    {t.type === "income" ? "+" : "-"}
                    {fmtValue(toDisplay(Number(t.amount), t.currency ?? "BRL"), displayCurrency)}
                  </span>
                  {!valuesHidden && (t.currency ?? "BRL") !== displayCurrency && (
                    <span className="block text-xs text-zinc-600 mt-0.5">
                      {fmtRaw(Number(t.amount), t.currency ?? "BRL")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <TransactionModal onClose={() => setShowModal(false)} />}
      {showRecurring && (
        <RecurringExpensesModal
          onClose={() => setShowRecurring(false)}
          expenses={allRecurringExpenses}
        />
      )}
    </div>
  );
}

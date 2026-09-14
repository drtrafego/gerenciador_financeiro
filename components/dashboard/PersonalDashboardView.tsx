"use client";

import React from "react";
import Link from "next/link";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { DICTIONARY } from "@/lib/i18n/dict";
import { 
  Sparkles, 
  Wallet, 
  Baby, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieIcon,
  Receipt
} from "lucide-react";

export default function PersonalDashboardView() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const totalIncomeBRL = 22000.00;
  const totalExpensesBRL = 14250.00;
  const balanceBRL = totalIncomeBRL - totalExpensesBRL;

  const childExpenses = [
    { name: "Matheus", total: "R$ 4.250,00", desc: "Escola Belgrano, materiais e judô" },
    { name: "Sofia", total: "R$ 2.800,00", desc: "Natação, pediatra e vestuário" }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950 via-zinc-900 to-indigo-950 p-6 rounded-2xl border border-purple-500/20 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {dict.dashboard.title}
          </h2>
          <p className="text-xs text-zinc-300">
            {dict.dashboard.subtitle} <strong className="text-purple-400 font-semibold">R$ Real (BRL) & $ Pesos (ARS)</strong> | Cotação: 1 BRL = 233.6 ARS
          </p>
        </div>
        <Link
          href="/scan"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 text-xs transition-all transform hover:scale-105"
        >
          <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
          <span>{dict.dashboard.scanQuickBtn}</span>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>{dict.dashboard.totalIncome}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            R$ {totalIncomeBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500">Pró-labore e retiradas</p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>{dict.dashboard.totalExpenses}</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400">
            R$ {totalExpensesBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500">Escola, Coto, moradia e lazer</p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>{dict.dashboard.balance}</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-400">
            R$ {balanceBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500">Saldo disponível no mês</p>
        </div>
      </div>

      {/* Grid Central */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Filhos */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-800 bg-gradient-to-b from-pink-950/20 to-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-pink-300 flex items-center gap-2">
              <Baby className="w-4 h-4 text-pink-400" />
              {dict.dashboard.childExpenses}
            </h3>
            <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium">
              Matheus & Sofia
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {childExpenses.map((child, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center font-bold text-xs">
                      {child.name[0]}
                    </span>
                    <h4 className="text-sm font-bold text-white">{child.name}</h4>
                  </div>
                  <p className="text-xs text-zinc-400">{child.desc}</p>
                </div>
                <span className="text-sm font-bold text-pink-400 font-mono">{child.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cotações */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-3">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            {dict.dashboard.exchangeRates}
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <span className="text-zinc-400">1 USD (Dólar)</span>
              <span className="font-mono font-bold text-white">5.65 BRL</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <span className="text-zinc-400">1 BRL (Real)</span>
              <span className="font-mono font-bold text-white">233.60 ARS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recentes */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-400" />
            {dict.dashboard.recentTransactions}
          </h3>
          <Link href="/scan" className="text-xs text-purple-400 hover:underline">
            + Escanear novo comprovante
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="p-3 rounded-l-xl">Data</th>
                <th className="p-3">Estabelecimento / Local</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Dependente</th>
                <th className="p-3 text-right rounded-r-xl">Valor Original</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <tr className="hover:bg-zinc-800/40">
                <td className="p-3 font-mono text-zinc-400">2026-09-14</td>
                <td className="p-3 font-semibold text-white">
                  Colegio Belgrano Day School <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded ml-1">🇦🇷 Factura AR</span>
                </td>
                <td className="p-3"><span className="bg-zinc-800 px-2 py-0.5 rounded">Filhos & Família</span></td>
                <td className="p-3"><span className="bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-bold">👶 Matheus</span></td>
                <td className="p-3 text-right font-mono font-bold text-rose-400">$ 285.000 ARS</td>
              </tr>
              <tr className="hover:bg-zinc-800/40">
                <td className="p-3 font-mono text-zinc-400">2026-09-13</td>
                <td className="p-3 font-semibold text-white">
                  Coto C.I.C.S.A. Palermo <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded ml-1">🇦🇷 Factura AR</span>
                </td>
                <td className="p-3"><span className="bg-zinc-800 px-2 py-0.5 rounded">Alimentação & Supermercado</span></td>
                <td className="p-3 text-zinc-500">-</td>
                <td className="p-3 text-right font-mono font-bold text-rose-400">$ 48.500 ARS</td>
              </tr>
              <tr className="hover:bg-zinc-800/40">
                <td className="p-3 font-mono text-zinc-400">2026-09-12</td>
                <td className="p-3 font-semibold text-white">
                  Pró-labore Empresa PJ <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded ml-1">🇧🇷 Transferência</span>
                </td>
                <td className="p-3"><span className="bg-zinc-800 px-2 py-0.5 rounded">Receita / Pró-labore</span></td>
                <td className="p-3 text-zinc-500">-</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-400">+ R$ 22.000,00 BRL</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

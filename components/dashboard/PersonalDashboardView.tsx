"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { DICTIONARY, Currency } from "@/lib/i18n/dict";
import { 
  Sparkles, 
  Wallet, 
  Baby, 
  ArrowUpRight, 
  ArrowDownRight,
  Receipt,
  Plus,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2,
  X,
  PieChart as PieIcon
} from "lucide-react";

export interface PersonalTransaction {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: Currency;
  type: 'expense' | 'income';
  category: string;
  childTag?: string;
  language: 'pt' | 'es';
}

interface CustomCategory {
  id: string;
  namePt: string;
  nameEs: string;
  limit: number;
  spent?: number;
  color: string;
  emoji?: string;
}

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", limit: 3500, color: "bg-pink-500/20 text-pink-400 border-pink-500/30", emoji: "👦" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", limit: 4500, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "🍕" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", limit: 2000, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", emoji: "🥳" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", limit: 5000, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🏠" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", limit: 2500, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", emoji: "💊" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", limit: 1800, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", emoji: "🚗" },
];

export default function PersonalDashboardView() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>(DEFAULT_CATEGORIES);
  const [childrenList, setChildrenList] = useState<string[]>(["Matheus", "Sofia"]);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [txCurrency, setTxCurrency] = useState<Currency>('ARS');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Alimentação & Supermercado');
  const [childTag, setChildTag] = useState('');

  // Carregar transações, categorias e lista de dependentes
  useEffect(() => {
    const savedTxs = localStorage.getItem('user_personal_transactions');
    if (savedTxs) {
      try {
        setTransactions(JSON.parse(savedTxs));
      } catch (e) {}
    }

    const storedCats = localStorage.getItem('personal_custom_categories');
    if (storedCats) {
      try {
        setCategories(JSON.parse(storedCats));
      } catch (e) {}
    }

    const storedChildren = localStorage.getItem('user_personal_children');
    if (storedChildren) {
      try {
        setChildrenList(JSON.parse(storedChildren));
      } catch (e) {}
    }
  }, []);

  const saveTransactions = (updated: PersonalTransaction[]) => {
    setTransactions(updated);
    localStorage.setItem('user_personal_transactions', JSON.stringify(updated));
  };

  const handleAddManualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: PersonalTransaction = {
      id: `tx-pf-${Date.now()}`,
      date,
      merchant,
      description,
      amount,
      currency: txCurrency,
      type,
      category,
      childTag: childTag || undefined,
      language: lang
    };
    const updated = [newTx, ...transactions];
    saveTransactions(updated);
    setShowManualModal(false);

    // Reset
    setMerchant('');
    setDescription('');
    setAmount(0);
    setChildTag('');
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    saveTransactions(updated);
  };

  // Cotação base de conversão para BRL no resumo
  const rates = { ARS: 233.6, BRL: 1, USD: 0.177 };

  // Totais convertidos dinâmicos
  const totalIncomeBRL = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + (t.currency === 'ARS' ? t.amount / rates.ARS : t.currency === 'USD' ? t.amount * 5.65 : t.amount), 0);

  const totalExpensesBRL = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + (t.currency === 'ARS' ? t.amount / rates.ARS : t.currency === 'USD' ? t.amount * 5.65 : t.amount), 0);

  const balanceBRL = totalIncomeBRL - totalExpensesBRL;

  // Helper para buscar emoji e cor da categoria
  const getCatBadgeInfo = (catName: string) => {
    const found = categories.find(c => c.namePt === catName || c.nameEs === catName);
    if (found) {
      return {
        emoji: found.emoji || "📂",
        color: found.color || "bg-zinc-800 text-zinc-300 border-zinc-700"
      };
    }
    return { emoji: "📂", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner Superior com Ações */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950 via-zinc-900 to-indigo-950 p-6 rounded-2xl border border-purple-500/20 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {dict.dashboard.title}
          </h2>
          <p className="text-xs text-zinc-300">
            {dict.dashboard.subtitle} <strong className="text-purple-400 font-semibold">R$ Real (BRL) & $ Pesos (ARS)</strong> | Cotação: 1 BRL = 233.6 ARS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 text-white text-xs transition-all border border-zinc-700"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>+ Lançar Gasto Manual</span>
          </button>

          <Link
            href="/scan"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 text-xs transition-all transform hover:scale-105"
          >
            <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
            <span>{dict.dashboard.scanQuickBtn}</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Dinâmicos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>{dict.dashboard.totalIncome}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            R$ {totalIncomeBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500">Pró-labore e receitas pessoais</p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>{dict.dashboard.totalExpenses}</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 font-mono">
            R$ {totalExpensesBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <p className={`text-2xl font-bold font-mono ${balanceBRL >= 0 ? 'text-purple-400' : 'text-rose-500'}`}>
            R$ {balanceBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500">Saldo líquido pessoal no mês</p>
        </div>
      </div>

      {/* Categorias & Orçamento Resumo no Dashboard */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-400" />
            Categorias & Orçamento Pessoal
          </h3>
          <Link href="/personal-categories" className="text-xs text-indigo-400 hover:underline font-semibold">
            Gerenciar Categorias & Emojis →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const catName = lang === 'pt' ? cat.namePt : cat.nameEs;
            const spentBRL = transactions
              .filter(t => t.type === 'expense' && (t.category === cat.namePt || t.category === cat.nameEs))
              .reduce((acc, t) => acc + (t.currency === 'ARS' ? t.amount / rates.ARS : t.currency === 'USD' ? t.amount * 5.65 : t.amount), 0);

            const pct = Math.min(Math.round((spentBRL / (cat.limit || 1)) * 100), 100);

            return (
              <div key={cat.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2 hover:border-zinc-700 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-base ${cat.color}`}>
                      {cat.emoji || "📂"}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{catName}</h4>
                      <p className="text-[10px] text-zinc-400 font-mono">Meta: R$ {cat.limit.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300 font-mono">{pct}%</span>
                </div>

                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct > 80 ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Central */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Filhos Dinâmico */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-800 bg-gradient-to-b from-pink-950/20 to-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-pink-300 flex items-center gap-2">
              <Baby className="w-4 h-4 text-pink-400" />
              {dict.dashboard.childExpenses}
            </h3>
            <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium">
              {childrenList.length > 0 ? childrenList.join(" & ") : "Sem dependentes"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {childrenList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-3">Nenhum dependente cadastrado. Adicione em Configurações.</p>
            ) : (
              childrenList.map((child) => {
                const childTotalBRL = transactions
                  .filter(t => t.childTag === child && t.type === 'expense')
                  .reduce((acc, t) => acc + (t.currency === 'ARS' ? t.amount / rates.ARS : t.currency === 'USD' ? t.amount * 5.65 : t.amount), 0);

                return (
                  <div key={child} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center font-bold text-xs">
                          {child.charAt(0).toUpperCase()}
                        </span>
                        <h4 className="text-sm font-bold text-white">{child}</h4>
                      </div>
                      <p className="text-xs text-zinc-400">Escola, vestuário & saúde</p>
                    </div>
                    <span className="text-sm font-bold text-pink-400 font-mono">
                      R$ {childTotalBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })
            )}
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
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setShowManualModal(true)}
              className="text-purple-400 hover:underline font-bold"
            >
              + Lançar gasto manual
            </button>
            <Link href="/scan" className="text-zinc-400 hover:text-white">
              Escanear comprovante IA
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-zinc-400">Nenhum gasto pessoal registrado ainda.</p>
              <p className="text-xs text-zinc-500">
                Utilize os botões <strong className="text-purple-400">+ Lançar Gasto Manual</strong> ou <strong className="text-purple-400">Escanear Foto / Print</strong> acima para adicionar seus gastos!
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3 rounded-l-xl">Data</th>
                  <th className="p-3">Estabelecimento / Local</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Dependente</th>
                  <th className="p-3 text-right">Valor Original</th>
                  <th className="p-3 text-center rounded-r-xl">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {transactions.map(tx => {
                  const catBadge = getCatBadgeInfo(tx.category);

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3 font-mono text-zinc-400">{tx.date}</td>
                      <td className="p-3 font-semibold text-white">
                        {tx.merchant}
                        {tx.currency === 'ARS' && (
                          <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded ml-1 border border-sky-500/20">
                            🇦🇷 AR
                          </span>
                        )}
                        {tx.currency === 'BRL' && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded ml-1 border border-emerald-500/20">
                            🇧🇷 BR
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-medium ${catBadge.color}`}>
                          <span>{catBadge.emoji}</span>
                          <span>{tx.category}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        {tx.childTag ? (
                          <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-bold">
                            👶 {tx.childTag}
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'income' ? '+' : '-'}{tx.currency === 'ARS' ? `$ ${tx.amount.toLocaleString()}` : `R$ ${tx.amount.toFixed(2)}`}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Lançar Gasto Manualmente */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Lançar Gasto / Receita Pessoal
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddManualTransaction} className="space-y-3">
              <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    type === 'expense' ? 'bg-rose-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Despesa (Gasto)
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    type === 'income' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Receita (Pró-labore / Entrada)
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Building2 size={13} className="text-purple-400" />
                  Estabelecimento / Descrição
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coto, Carrefour, Colegio, iFood, PedidosYa, Farmacity"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <DollarSign size={13} className="text-purple-400" />
                    Valor
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Moeda</label>
                  <select
                    value={txCurrency}
                    onChange={(e) => setTxCurrency(e.target.value as Currency)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-purple-500 outline-none"
                  >
                    <option value="ARS">$ ARS (Argentina)</option>
                    <option value="BRL">R$ BRL (Brasil)</option>
                    <option value="USD">$ USD (Dólar)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Calendar size={13} className="text-purple-400" />
                  Data do Gasto
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Tag size={13} className="text-purple-400" />
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                >
                  {categories.map((c) => {
                    const label = lang === 'pt' ? c.namePt : c.nameEs;
                    return (
                      <option key={c.id} value={c.namePt}>
                        {c.emoji ? `${c.emoji} ` : ''}{label}
                      </option>
                    );
                  })}
                  <option value="Receita / Pró-labore">💰 Receita / Pró-labore</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-pink-400 flex items-center gap-1">
                  <Baby size={13} className="text-pink-400" />
                  Vincular a Filho / Dependente
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setChildTag('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      !childTag
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                        : 'border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Nenhum
                  </button>
                  {childrenList.map((child) => (
                    <button
                      key={child}
                      type="button"
                      onClick={() => setChildTag(child)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        childTag === child
                          ? 'bg-pink-500/20 border-pink-500/40 text-pink-300 font-bold'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      👶 {child}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Salvar Gasto Pessoal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

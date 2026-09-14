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
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Filter,
  BarChart3,
  Flame,
  Award
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";

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

const CATEGORY_PIE_COLORS = [
  "#ec4899", // pink
  "#10b981", // emerald
  "#a855f7", // purple
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#eab308", // yellow
];

export default function PersonalDashboardView() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>(DEFAULT_CATEGORIES);
  const [childrenList, setChildrenList] = useState<string[]>(["Matheus", "Sofia"]);
  const [showManualModal, setShowManualModal] = useState(false);

  // Period Filter State: 'current_month' | 'previous_month' | 'last_3_months' | 'all'
  const [periodFilter, setPeriodFilter] = useState<'current_month' | 'previous_month' | 'last_3_months' | 'all'>('current_month');

  // Manual Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [txCurrency, setTxCurrency] = useState<Currency>('ARS');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Alimentação & Supermercado');
  const [childTag, setChildTag] = useState('');

  // Rate table for multi-currency conversion
  const rates = { ARS: 233.6, BRL: 1, USD: 0.177 };

  useEffect(() => {
    setMounted(true);
    const loadAllPersonalData = () => {
      const savedTxs = localStorage.getItem('user_personal_transactions');
      if (savedTxs) {
        try {
          setTransactions(JSON.parse(savedTxs));
        } catch (e) {}
      }

      const storedCats = localStorage.getItem('personal_custom_categories');
      if (storedCats) {
        try {
          const parsed = JSON.parse(storedCats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const merged = parsed.map((sc: any) => {
              const defaultMatch = DEFAULT_CATEGORIES.find(dc => dc.id === sc.id || dc.namePt === sc.namePt);
              const emoji = (sc.emoji && sc.emoji !== "📂") ? sc.emoji : (defaultMatch?.emoji || sc.emoji || "📂");
              const color = (sc.color && sc.color !== "bg-indigo-500/20 text-indigo-400 border-indigo-500/30") ? sc.color : (defaultMatch?.color || sc.color || "bg-indigo-500/20 text-indigo-400 border-indigo-500/30");

              return {
                ...defaultMatch,
                ...sc,
                emoji,
                color
              };
            });
            setCategories(merged);
          }
        } catch (e) {}
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }

      const storedChildren = localStorage.getItem('user_personal_children');
      if (storedChildren) {
        try {
          setChildrenList(JSON.parse(storedChildren));
        } catch (e) {}
      }
    };

    loadAllPersonalData();

    window.addEventListener('user_pf_data_changed', loadAllPersonalData);
    window.addEventListener('storage', loadAllPersonalData);

    return () => {
      window.removeEventListener('user_pf_data_changed', loadAllPersonalData);
      window.removeEventListener('storage', loadAllPersonalData);
    };
  }, []);

  const saveTransactions = (updated: PersonalTransaction[]) => {
    setTransactions(updated);
    localStorage.setItem('user_personal_transactions', JSON.stringify(updated));
    window.dispatchEvent(new Event('user_pf_data_changed'));
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

  // Helper para converter valor para BRL
  const toBRL = (amount: number, curr: Currency) => {
    if (curr === 'ARS') return amount / rates.ARS;
    if (curr === 'USD') return amount * 5.65;
    return amount;
  };

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

  // -------------------------------------------------------------
  // PERÍODOS & FILTROS
  // -------------------------------------------------------------
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthYear = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const threeMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  // Transações filtradas pelo período selecionado
  const filteredTransactions = transactions.filter(t => {
    if (periodFilter === 'all') return true;
    if (!t.date) return true;
    
    if (periodFilter === 'current_month') {
      return t.date.startsWith(currentMonthYear);
    }
    if (periodFilter === 'previous_month') {
      return t.date.startsWith(prevMonthYear);
    }
    if (periodFilter === 'last_3_months') {
      const txDate = new Date(t.date);
      return txDate >= threeMonthsAgoDate;
    }
    return true;
  });

  // Totais convertidos dinâmicos no período filtrado
  const totalIncomeBRL = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const totalExpensesBRL = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const balanceBRL = totalIncomeBRL - totalExpensesBRL;

  // -------------------------------------------------------------
  // CÁLCULO COMPARATIVO MÊS A MÊS (MoM)
  // -------------------------------------------------------------
  const currentMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthYear))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const prevMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(prevMonthYear))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const momExpensesDiffBRL = currentMonthExpensesBRL - prevMonthExpensesBRL;
  const momExpensesPct = prevMonthExpensesBRL > 0 
    ? ((momExpensesDiffBRL / prevMonthExpensesBRL) * 100) 
    : 0;

  // Categoria de maior gasto no mês
  const categorySpendingMap: Record<string, number> = {};
  filteredTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categorySpendingMap[t.category] = (categorySpendingMap[t.category] || 0) + toBRL(t.amount, t.currency);
    });

  let topCategoryName = "";
  let topCategoryAmount = 0;
  Object.entries(categorySpendingMap).forEach(([cat, val]) => {
    if (val > topCategoryAmount) {
      topCategoryAmount = val;
      topCategoryName = cat;
    }
  });

  // -------------------------------------------------------------
  // DADOS PARA OS GRÁFICOS (RECHARTS)
  // -------------------------------------------------------------
  
  // 1. Gráfico Rosca / Pie de Categorias
  const pieChartData = Object.entries(categorySpendingMap).map(([name, value]) => {
    const info = getCatBadgeInfo(name);
    return {
      name,
      value: Math.round(value * 100) / 100,
      emoji: info.emoji
    };
  }).sort((a, b) => b.value - a.value);

  // 2. Gráfico de Histórico Mensal (Receitas vs Despesas)
  const monthlyDataMap: Record<string, { monthKey: string; monthLabel: string; income: number; expense: number }> = {};

  // Gerar slots para os últimos 6 meses caso o usuário não tenha muitas txs antigas
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(lang === 'es' ? 'es-AR' : 'pt-BR', { month: 'short' }).replace('.', '');
    monthlyDataMap[key] = { monthKey: key, monthLabel: label.toUpperCase(), income: 0, expense: 0 };
  }

  // Preencher com os dados reais do usuário
  transactions.forEach(t => {
    if (!t.date) return;
    const key = t.date.substring(0, 7);
    if (!monthlyDataMap[key]) {
      const txDate = new Date(t.date);
      const label = txDate.toLocaleDateString(lang === 'es' ? 'es-AR' : 'pt-BR', { month: 'short' }).replace('.', '');
      monthlyDataMap[key] = { monthKey: key, monthLabel: label.toUpperCase(), income: 0, expense: 0 };
    }

    const val = toBRL(t.amount, t.currency);
    if (t.type === 'income') {
      monthlyDataMap[key].income += val;
    } else {
      monthlyDataMap[key].expense += val;
    }
  });

  const barTrendData = Object.values(monthlyDataMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(d => ({
      Mês: d.monthLabel,
      Receitas: Math.round(d.income),
      Despesas: Math.round(d.expense)
    }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
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

      {/* Bar de Seleção de Perfil Temporal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
          <Filter size={15} className="text-purple-400" />
          <span>Filtrar Período de Visualização:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => setPeriodFilter('current_month')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodFilter === 'current_month'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mês Atual
          </button>

          <button
            onClick={() => setPeriodFilter('previous_month')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodFilter === 'previous_month'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mês Anterior
          </button>

          <button
            onClick={() => setPeriodFilter('last_3_months')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodFilter === 'last_3_months'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Últimos 3 Meses
          </button>

          <button
            onClick={() => setPeriodFilter('all')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodFilter === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({transactions.length})
          </button>
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
          <p className="text-xs text-zinc-500">Saldo líquido pessoal no período</p>
        </div>
      </div>

      {/* Cards de Métricas Comparativas MoM & Categoria Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card MoM Comparativo */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-purple-950/30 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-zinc-300">Comparativo Mês a Mês (MoM)</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {momExpensesDiffBRL <= 0 ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono">
                  <TrendingDown size={16} />
                  -R$ {Math.abs(momExpensesDiffBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (-{Math.abs(momExpensesPct).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 font-mono">
                  <TrendingUp size={16} />
                  +R$ {momExpensesDiffBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+{momExpensesPct.toFixed(1)}%)
                </span>
              )}
            </p>
            <p className="text-[11px] text-zinc-400">
              Variação dos gastos em relação ao mês anterior (Mês Atual: R$ {currentMonthExpensesBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} vs Mês Anterior: R$ {prevMonthExpensesBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}).
            </p>
          </div>

          <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 ${
            momExpensesDiffBRL <= 0 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className="text-lg font-black font-mono">
              {momExpensesDiffBRL <= 0 ? `${Math.abs(momExpensesPct).toFixed(0)}%` : `+${momExpensesPct.toFixed(0)}%`}
            </span>
            <span className="text-[10px] font-bold uppercase">{momExpensesDiffBRL <= 0 ? 'Economia' : 'Aumento'}</span>
          </div>
        </div>

        {/* Card Maior Categoria de Gasto */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-indigo-950/30 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-zinc-300">Maior Gasto do Período</span>
            </div>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <span>{getCatBadgeInfo(topCategoryName).emoji}</span>
              <span>{topCategoryName || "Nenhum lançamento"}</span>
            </p>
            <p className="text-[11px] text-zinc-400">
              Corresponde a <strong className="text-purple-300 font-mono">R$ {topCategoryAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> do total gasto no período selecionado.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex flex-col items-center justify-center flex-shrink-0">
            <Award size={24} />
            <span className="text-[10px] font-bold uppercase mt-1">Topo #1</span>
          </div>
        </div>
      </div>

      {/* GRÁFICOS VISUAIS INTERATIVOS (RECHARTS) */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico 1: Distribuição de Gastos por Categoria (Rosca / Pie) */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-purple-400" />
                Distribuição de Gastos por Categoria
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Equivalente em BRL</span>
            </div>

            {pieChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Sem despesas registradas no período selecionado.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CATEGORY_PIE_COLORS[index % CATEGORY_PIE_COLORS.length]} 
                          stroke="#18181b" 
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }}
                      labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                      formatter={(val: any, name: any) => [
                        `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        `${name}`
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => {
                        const item = pieChartData.find(p => p.name === value);
                        return (
                          <span className="text-[11px] text-zinc-300 font-medium">
                            {item?.emoji || "📂"} {value}
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gráfico 2: Evolução Histórica de Receitas vs Despesas (Barras) */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Histórico & Tendências (Últimos Meses)
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Valores em R$</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="Mês" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }}
                    labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                    formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
            const spentBRL = filteredTransactions
              .filter(t => t.type === 'expense' && (t.category === cat.namePt || t.category === cat.nameEs))
              .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

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
                      <p className="text-[10px] text-zinc-400 font-mono">
                        Gasto: R$ {spentBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / Meta: R$ {cat.limit.toLocaleString()}
                      </p>
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
                const childTotalBRL = filteredTransactions
                  .filter(t => t.childTag === child && t.type === 'expense')
                  .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

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
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-zinc-400">Nenhum gasto pessoal registrado no período selecionado.</p>
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
                {filteredTransactions.map(tx => {
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
                        {tx.currency === 'USD' && (
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded ml-1 border border-purple-500/20">
                            🇺🇸 US
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
                        {tx.type === 'income' ? '+' : '-'}{tx.currency === 'ARS' ? `$ ${tx.amount.toLocaleString()}` : tx.currency === 'USD' ? `$ ${tx.amount.toFixed(2)}` : `R$ ${tx.amount.toFixed(2)}`}
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

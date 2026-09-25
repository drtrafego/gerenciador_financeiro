"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { DICTIONARY, Currency } from "@/lib/i18n/dict";
import { DEMO_PERSONAL_TRANSACTIONS } from "@/lib/ai/receiptScanner";
import PeriodBar from "@/components/shared/PeriodBar";
import { resolvePeriod } from "@/lib/period";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import { 
  Sparkles, 
  Wallet, 
  Baby, 
  User,
  ArrowUpRight, 
  ArrowDownRight,
  Receipt,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
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
  subcategory?: string;
  childTag?: string;
  parentTag?: string;
  language: 'pt' | 'es';
  selected?: boolean;
  isInternalTransfer?: boolean;
}

interface CustomCategory {
  id: string;
  namePt: string;
  nameEs: string;
  subcategories?: string[];
  limit: number;
  spent?: number;
  color: string;
  emoji?: string;
}

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", subcategories: ["Escola / Colegiatura", "Natação & Esportes", "Vestuário Infantil", "Brinquedos"], limit: 3500, color: "bg-pink-500/20 text-pink-400 border-pink-500/30", emoji: "👦" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", subcategories: ["Supermercado (Coto / Carrefour)", "Feira & Orgânicos", "Restaurantes & Delivery (iFood/PedidosYa)"], limit: 4500, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "🍕" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", subcategories: ["Uber / Cabify", "Oficina & Manutenção", "Transporte Público (SUBE/Subte)", "Combustível & Estacionamento"], limit: 1800, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", emoji: "🚗" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", subcategories: ["Aluguel / Condomínio", "Energia (Edesur/Luz)", "Gás & Água", "Internet & Wifi", "Assinaturas & Software"], limit: 5000, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🏠" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", subcategories: ["Plano de Saúde (Prepaga/OSDE)", "Farmácia (Farmacity)", "Consultas & Exames", "Academia & Esportes"], limit: 2500, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", emoji: "💊" },
  { id: "cat-shopping", namePt: "Compras & Vestuário", nameEs: "Compras y Vestuario", subcategories: ["Roupas & Calçados", "Eletrônicos & Casa", "Compras Gerais (Mercado Livre)"], limit: 3000, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", emoji: "🛍️" },
  { id: "cat-transfers", namePt: "Transferências & Outros", nameEs: "Transferencias y Otros", subcategories: ["Transferências Gerais", "Taxas & Tarifas"], limit: 10000, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", emoji: "💸" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", subcategories: ["Passeios em Família", "Cinema & Shows", "Assinaturas (Netflix/Spotify)", "Viagens"], limit: 2000, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", emoji: "🥳" },
  { id: "cat-general", namePt: "Geral & Diversos", nameEs: "General y Diversos", subcategories: ["Despesas Gerais", "Lançamentos Históricos", "Não Identificados"], limit: 5000, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", emoji: "📦" },
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

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function PersonalDashboardView() {
  const { lang } = useProfile();
  const { hidden: valuesHidden } = useValuesVisibility();
  const dict = DICTIONARY[lang];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const maskBRL = (val: number, opts?: Intl.NumberFormatOptions) => {
    if (valuesHidden) return "••••••";
    return `R$ ${val.toLocaleString('pt-BR', opts || { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const maskOrig = (amount: number, curr: Currency, sign: string = '') => {
    if (valuesHidden) return "••••••";
    const prefix = curr === 'ARS' ? '$ ' : curr === 'USD' ? 'US$ ' : 'R$ ';
    const formatted = curr === 'ARS'
      ? amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${prefix}${formatted}`;
  };

  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>(
    (DEMO_PERSONAL_TRANSACTIONS || []).map(t => ({
      ...t,
      type: (t.type || 'expense') as 'expense' | 'income',
      language: (t.language || 'es') as 'pt' | 'es'
    })) as PersonalTransaction[]
  );
  const [categories, setCategories] = useState<CustomCategory[]>(DEFAULT_CATEGORIES);
  const [childrenList, setChildrenList] = useState<string[]>([]);
  const [parentsList, setParentsList] = useState<string[]>(["Gastão", "Amanda"]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [hideInternalTransfers, setHideInternalTransfers] = useState<boolean>(true);
  const [showOnlyExpenses, setShowOnlyExpenses] = useState<boolean>(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Edit modal state
  const [editingTx, setEditingTx] = useState<PersonalTransaction | null>(null);

  // Manual Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [txCurrency, setTxCurrency] = useState<Currency>('ARS');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Alimentação & Supermercado');
  const [subcategory, setSubcategory] = useState('');
  const [childTag, setChildTag] = useState('');

  // Rate table for multi-currency conversion
  const rates = { ARS: 233.6, BRL: 1, USD: 0.177 };

  useEffect(() => {
    setMounted(true);

    const deduplicateTransactions = (list: any[]) => {
      const seen = new Set<string>();
      const clean: any[] = [];
      for (const tx of list) {
        const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const key = `${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;
        if (!seen.has(key)) {
          seen.add(key);
          clean.push(tx);
        }
      }
      return clean;
    };

    const loadAllPersonalData = () => {
      // Versão dos dados para forçar sincronização automática no navegador
      const DATA_VERSION = "2026-09-v4-amanda-gastao-misericordia";
      const savedVersion = localStorage.getItem('user_personal_data_version');
      
      const builtinTxs: any[] = DEMO_PERSONAL_TRANSACTIONS || [];
      let combined: any[] = [...builtinTxs];

      // Se a versão do cache for antiga, atualiza automaticamente com os 1.846 dados consolidados
      if (savedVersion !== DATA_VERSION) {
        localStorage.setItem('user_personal_data_version', DATA_VERSION);
        localStorage.removeItem('user_personal_transactions');
        localStorage.removeItem('user_personal_parents');
      } else {
        const savedTxs = localStorage.getItem('user_personal_transactions');
        if (savedTxs) {
          try {
            const parsed = JSON.parse(savedTxs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const builtinIds = new Set(builtinTxs.map((t: any) => t.id));
              const extraTxs = parsed.filter((t: any) => !builtinIds.has(t.id));
              combined = [...builtinTxs, ...extraTxs];
            }
          } catch (e) {}
        }
      }

      const deduped: PersonalTransaction[] = deduplicateTransactions(combined).map((t: any) => ({
        ...t,
        type: (t.type || 'expense') as 'expense' | 'income',
        language: (t.language || 'es') as 'pt' | 'es'
      }));
      setTransactions(deduped);
      localStorage.setItem('user_personal_transactions', JSON.stringify(deduped));

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

            const existingIds = new Set(parsed.map((p: any) => p.id || p.namePt));
            const missingDefaults = DEFAULT_CATEGORIES.filter(dc => !existingIds.has(dc.id) && !existingIds.has(dc.namePt));
            const allCats = [...merged, ...missingDefaults];
            setCategories(allCats);
          } else {
            setCategories(DEFAULT_CATEGORIES);
          }
        } catch (e) {
          setCategories(DEFAULT_CATEGORIES);
        }
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }

      const storedParents = localStorage.getItem('user_personal_parents');
      if (storedParents) {
        try {
          const parsed = JSON.parse(storedParents);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setParentsList(parsed);
          } else {
            const found = Array.from(new Set(deduped.map(t => t.childTag || t.parentTag).filter(Boolean))) as string[];
            const p = found.length > 0 ? found : ["Gastão", "Amanda"];
            setParentsList(p);
            localStorage.setItem('user_personal_parents', JSON.stringify(p));
          }
        } catch (e) {
          setParentsList(["Gastão", "Amanda"]);
        }
      } else {
        const found = Array.from(new Set(deduped.map(t => t.childTag || t.parentTag).filter(Boolean))) as string[];
        const p = found.length > 0 ? found : ["Gastão", "Amanda"];
        setParentsList(p);
        localStorage.setItem('user_personal_parents', JSON.stringify(p));
      }

      const storedChildren = localStorage.getItem('user_personal_children');
      if (storedChildren) {
        try {
          const parsed = JSON.parse(storedChildren);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChildrenList(parsed);
          } else {
            setChildrenList([]);
          }
        } catch (e) {
          setChildrenList([]);
        }
      } else {
        setChildrenList([]);
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

  const handleUpdateEditingTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const updated = transactions.map(t => (t.id === editingTx.id ? editingTx : t));
    saveTransactions(updated);
    setEditingTx(null);
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

  // Helper para casar categoria da transação com categoria cadastrada
  const matchesCategory = (txCat: string, catPt: string, catEs: string) => {
    const t = (txCat || '').toLowerCase().trim();
    const p = (catPt || '').toLowerCase().trim();
    const e = (catEs || '').toLowerCase().trim();
    if (!t) return false;
    if (t === p || t === e || t.includes(p) || p.includes(t) || t.includes(e) || e.includes(t)) return true;
    if (p.includes('alimenta') && (t.includes('alimenta') || t.includes('mercado'))) return true;
    if (p.includes('transporte') && (t.includes('transporte') || t.includes('uber') || t.includes('veículo'))) return true;
    if (p.includes('moradia') && (t.includes('moradia') || t.includes('serviço') || t.includes('luz') || t.includes('aluguel'))) return true;
    if (p.includes('saúde') && (t.includes('saúde') || t.includes('farmácia') || t.includes('médico'))) return true;
    if (p.includes('compras') && (t.includes('compras') || t.includes('vestuário') || t.includes('loja'))) return true;
    if (p.includes('transfer') && (t.includes('transfer') || t.includes('crédito') || t.includes('débito'))) return true;
    if (p.includes('filhos') && (t.includes('filhos') || t.includes('família') || t.includes('escola') || t.includes('colégio'))) return true;
    if (p.includes('lazer') && (t.includes('lazer') || t.includes('entretenimento') || t.includes('cinema') || t.includes('restaurante'))) return true;
    if ((p.includes('geral') || p.includes('diversos')) && (t.includes('geral') || t.includes('diversos') || t.includes('outros') || t.includes('histórico'))) return true;
    return false;
  };

  const getNormalizedCategory = (rawCat: string) => {
    for (const c of categories) {
      if (matchesCategory(rawCat, c.namePt, c.nameEs)) {
        return lang === 'pt' ? c.namePt : c.nameEs;
      }
    }
    return rawCat || (lang === 'pt' ? "Geral & Diversos" : "General y Diversos");
  };

  // -------------------------------------------------------------
  // CONTROLE DE PERÍODO & DATAS (SELETOR DA EMPRESA)
  // -------------------------------------------------------------
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const { from, to } = resolvePeriod({
    from: fromParam || undefined,
    to: toParam || undefined,
  });

  const now = new Date();

  // Transações filtradas pelo período selecionado, membro familiar e exclusão de transferências internas
  const filteredTransactions = transactions.filter(t => {
    if (!t.date) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;

    // Se estiver filtrando apenas despesas reais de consumo (sem transferências internas entre o casal)
    if (hideInternalTransfers && t.isInternalTransfer) {
      return false;
    }

    if (showOnlyExpenses && t.type !== 'expense') {
      return false;
    }

    if (selectedMember === 'Misericordia') {
      const d = ((t.description || '') + ' ' + (t.merchant || '')).toLowerCase();
      return d.includes('misericordia');
    }

    if (selectedMember !== 'all') {
      const tag = t.childTag || t.parentTag || '';
      if (tag !== selectedMember) return false;
    }
    return true;
  });

  // Totais convertidos dinâmicos no período filtrado (Foco em Despesas)
  const totalExpensesBRL = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const totalExpensesARS = filteredTransactions
    .filter(t => t.type === 'expense' && t.currency === 'ARS')
    .reduce((acc, t) => acc + t.amount, 0);

  // Gastos Amanda no período
  const amandaExpensesBRL = filteredTransactions
    .filter(t => t.type === 'expense' && (t.childTag === 'Amanda' || t.parentTag === 'Amanda'))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);
  const amandaExpensesARS = filteredTransactions
    .filter(t => t.type === 'expense' && t.currency === 'ARS' && (t.childTag === 'Amanda' || t.parentTag === 'Amanda'))
    .reduce((acc, t) => acc + t.amount, 0);
  const amandaTxCount = filteredTransactions
    .filter(t => t.type === 'expense' && (t.childTag === 'Amanda' || t.parentTag === 'Amanda')).length;

  // Gastos Gastão no período
  const gastaoExpensesBRL = filteredTransactions
    .filter(t => t.type === 'expense' && (t.childTag === 'Gastão' || t.parentTag === 'Gastão'))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);
  const gastaoExpensesARS = filteredTransactions
    .filter(t => t.type === 'expense' && t.currency === 'ARS' && (t.childTag === 'Gastão' || t.parentTag === 'Gastão'))
    .reduce((acc, t) => acc + t.amount, 0);
  const gastaoTxCount = filteredTransactions
    .filter(t => t.type === 'expense' && (t.childTag === 'Gastão' || t.parentTag === 'Gastão')).length;

  // Gastos Escola & Filhos (Colegio Misericordia) no período
  const schoolExpenses = filteredTransactions
    .filter(t => t.type === 'expense' && (
      t.category === 'Filhos & Família' || 
      (t.merchant || '').toLowerCase().includes('misericordia') ||
      (t.description || '').toLowerCase().includes('misericordia')
    ));
  const schoolExpensesBRL = schoolExpenses.reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);
  const schoolExpensesARS = schoolExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);

  // -------------------------------------------------------------
  // CÁLCULO COMPARATIVO MÊS A MÊS (MoM)
  // -------------------------------------------------------------
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthYear = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthYear) && (!hideInternalTransfers || !t.isInternalTransfer))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const prevMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(prevMonthYear) && (!hideInternalTransfers || !t.isInternalTransfer))
    .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

  const momExpensesDiffBRL = currentMonthExpensesBRL - prevMonthExpensesBRL;
  const momExpensesPct = prevMonthExpensesBRL > 0 
    ? ((momExpensesDiffBRL / prevMonthExpensesBRL) * 100) 
    : 0;

  // Categoria de maior gasto no mês e contadores
  const categorySpendingMap: Record<string, number> = {};
  const categoryCountMap: Record<string, number> = {};
  filteredTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const catName = getNormalizedCategory(t.category);
      categorySpendingMap[catName] = (categorySpendingMap[catName] || 0) + toBRL(t.amount, t.currency);
      categoryCountMap[catName] = (categoryCountMap[catName] || 0) + 1;
    });

  let topCategoryName = "";
  let topCategoryAmount = 0;
  let topCategoryCount = 0;
  Object.entries(categorySpendingMap).forEach(([cat, val]) => {
    if (val > topCategoryAmount) {
      topCategoryAmount = val;
      topCategoryName = cat;
      topCategoryCount = categoryCountMap[cat] || 0;
    }
  });

  // Maior compra individual única do período
  const topSingleExpense: PersonalTransaction | null = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce<PersonalTransaction | null>((max, curr) => {
      const val = toBRL(curr.amount, curr.currency);
      const maxVal = max ? toBRL(max.amount, max.currency) : 0;
      return val > maxVal ? curr : max;
    }, null);

  const topSingleExpenseBRL = topSingleExpense
    ? toBRL(topSingleExpense.amount, topSingleExpense.currency)
    : 0;

  // Categoria atualmente selecionada pelo clique do usuário
  const selectedCatObj = categories.find(c => c.id === selectedCategoryId) || null;
  const selectedCategoryExpenses = selectedCatObj
    ? filteredTransactions.filter(t => t.type === 'expense' && matchesCategory(t.category, selectedCatObj.namePt, selectedCatObj.nameEs))
    : [];
  const selectedCatSpentBRL = selectedCategoryExpenses.reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);
  const selectedCatSpentARS = selectedCategoryExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);

  // -------------------------------------------------------------
  // DADOS PARA OS GRÁFICOS (RECHARTS)
  // -------------------------------------------------------------
  
  // 1. Gráfico Rosca / Pie de Categorias (Formatado Limpo)
  const pieChartData = Object.entries(categorySpendingMap).map(([name, value]) => {
    const info = getCatBadgeInfo(name);
    return {
      name,
      value: Math.round(value * 100) / 100,
      emoji: info.emoji
    };
  }).sort((a, b) => b.value - a.value);

  // 2. Gráfico de Histórico Mensal de Gastos (Amanda vs Gastão)
  const monthlyDataMap: Record<string, { monthKey: string; monthLabel: string; amanda: number; gastao: number; total: number }> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(lang === 'es' ? 'es-AR' : 'pt-BR', { month: 'short' }).replace('.', '');
    monthlyDataMap[key] = { monthKey: key, monthLabel: label.toUpperCase(), amanda: 0, gastao: 0, total: 0 };
  }

  transactions.forEach(t => {
    if (!t.date || t.type !== 'expense') return;
    if (hideInternalTransfers && t.isInternalTransfer) return;

    const key = t.date.substring(0, 7);
    if (!monthlyDataMap[key]) {
      const txDate = new Date(t.date);
      const label = txDate.toLocaleDateString(lang === 'es' ? 'es-AR' : 'pt-BR', { month: 'short' }).replace('.', '');
      monthlyDataMap[key] = { monthKey: key, monthLabel: label.toUpperCase(), amanda: 0, gastao: 0, total: 0 };
    }

    const val = toBRL(t.amount, t.currency);
    const tag = t.childTag || t.parentTag || '';
    if (tag === 'Amanda') {
      monthlyDataMap[key].amanda += val;
    } else {
      monthlyDataMap[key].gastao += val;
    }
    monthlyDataMap[key].total += val;
  });

  const barTrendData = Object.values(monthlyDataMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(d => ({
      Mês: d.monthLabel,
      "Gastos Amanda": Math.round(d.amanda),
      "Gastos Gastão": Math.round(d.gastao),
      Total: Math.round(d.total)
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
            Acompanhe o controle financeiro pessoal, despesas dos titulares e dependentes familiares.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all w-full sm:w-auto"
          >
            <Sparkles size={15} />
            <span>Escanear Comprovante / Extrato</span>
          </Link>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-all w-full sm:w-auto"
          >
            <Plus size={15} />
            <span>Lançar Manualmente</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE DATAS IDÊNTICO AO DA EMPRESA (PERIODBAR) */}
      <PeriodBar from={from} to={to}>
        <div className="text-xs text-zinc-400 font-mono">
          Exibindo <strong className="text-purple-300">{filteredTransactions.length}</strong> de {transactions.length} lançamentos
        </div>
      </PeriodBar>

      {/* Grid das Pessoas Titulares e Filhos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: Titulares */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gastos dos Titulares</h3>
            </div>
            <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
              Titulares Pessoais
            </span>
          </div>

          {parentsList.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-center space-y-1">
              <p className="text-xs font-semibold text-zinc-400">Nenhum titular cadastrado ainda</p>
              <p className="text-[11px] text-zinc-500">Cadastre os titulares nas configurações para atribuir gastos individualmente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {parentsList.map((parent) => {
                const parentExpensesBRL = filteredTransactions
                  .filter(t => t.childTag === parent && t.type === 'expense')
                  .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

                const parentTxCount = filteredTransactions.filter(t => t.childTag === parent).length;

                return (
                  <div key={parent} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                        <span>👤</span> {parent}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">{parentTxCount} txs</span>
                    </div>
                    <p className="text-sm font-bold font-mono text-purple-300">
                      {maskBRL(parentExpensesBRL)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CARD 2: Filhos & Dependentes */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <Baby className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gastos dos Filhos / Dependentes</h3>
            </div>
            <Link href="/settings" className="text-[10px] text-indigo-400 hover:underline font-semibold">
              Gerenciar Filhos →
            </Link>
          </div>

          {childrenList.length === 0 ? (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <span>🎒</span> Colegio Misericordia (Escola)
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{schoolExpenses.length} mensalidades</span>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold font-mono text-pink-400">
                  {maskBRL(schoolExpensesBRL)}
                </p>
                <span className="text-[11px] font-mono text-zinc-400">
                  {valuesHidden ? '••••••' : `$ ${schoolExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Mensalidades escolares dos filhos pagas no período selecionado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {childrenList.map((child) => {
                const childExpensesBRL = filteredTransactions
                  .filter(t => t.childTag === child && t.type === 'expense')
                  .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

                const childTxCount = filteredTransactions.filter(t => t.childTag === child).length;

                return (
                  <div key={child} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                        <span>👶</span> {child}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">{childTxCount} txs</span>
                    </div>
                    <p className="text-sm font-bold font-mono text-pink-400">
                      {maskBRL(childExpensesBRL)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais (Foco em Despesas Reais) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Despesas Família */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Total de Gastos (Família)</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-rose-400">
            {maskBRL(totalExpensesBRL)}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({filteredTransactions.filter(t => t.type === 'expense').length} despesas)
          </p>
        </div>

        {/* Gastos Amanda */}
        <div className="p-5 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-zinc-900 to-pink-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-pink-300">👤 Gastos Amanda</span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <User className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-pink-400">
            {maskBRL(amandaExpensesBRL)}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${amandaExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({amandaTxCount} despesas)
          </p>
        </div>

        {/* Gastos Gastão */}
        <div className="p-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-zinc-900 to-indigo-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-indigo-300">👤 Gastos Gastão</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <User className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-indigo-400">
            {maskBRL(gastaoExpensesBRL)}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${gastaoExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({gastaoTxCount} despesas)
          </p>
        </div>

        {/* Escola & Filhos (Colegio Misericordia) */}
        <div className="p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-amber-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-amber-300">🎒 Escola & Filhos</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Baby className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-400">
            {maskBRL(schoolExpensesBRL)}
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${schoolExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} (Colegio Misericordia)
          </p>
        </div>
      </div>

      {/* Cards de Métricas Comparativas MoM & Categoria Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card MoM Comparativo */}
        <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-purple-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-zinc-300">Comparativo Mês a Mês (MoM)</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {valuesHidden ? (
                <span className="text-zinc-400 font-mono">••••••</span>
              ) : momExpensesDiffBRL <= 0 ? (
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
              {valuesHidden ? (
                "Variação dos gastos em relação ao mês anterior."
              ) : (
                `Variação dos gastos em relação ao mês anterior (Mês Atual: R$ ${currentMonthExpensesBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} vs Mês Anterior: R$ ${prevMonthExpensesBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}).`
              )}
            </p>
          </div>

          <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 ${
            momExpensesDiffBRL <= 0 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className="text-lg font-black font-mono">
              {valuesHidden ? "••%" : momExpensesDiffBRL <= 0 ? `${Math.abs(momExpensesPct).toFixed(0)}%` : `+${momExpensesPct.toFixed(0)}%`}
            </span>
            <span className="text-[10px] font-bold uppercase">{momExpensesDiffBRL <= 0 ? 'Economia' : 'Aumento'}</span>
          </div>
        </div>

        {/* Card Maior Categoria de Gastos */}
        <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-indigo-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-zinc-300">Categoria com Maior Volume de Gastos</span>
            </div>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <span>{getCatBadgeInfo(topCategoryName).emoji}</span>
              <span>{topCategoryName || "Nenhum lançamento"}</span>
            </p>
            <p className="text-[11px] text-zinc-400">
              Soma acumulada de {topCategoryCount} {topCategoryCount === 1 ? 'despesa' : 'despesas'}: <strong className="text-purple-300 font-mono">{maskBRL(topCategoryAmount)}</strong>
            </p>
            {topSingleExpense && (
              <p className="text-[10px] text-zinc-400 border-t border-zinc-800/60 pt-1">
                Maior compra individual única: <strong className="text-white">{topSingleExpense.merchant}</strong> ({maskBRL(topSingleExpenseBRL)})
              </p>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex flex-col items-center justify-center flex-shrink-0">
            <Award size={24} />
            <span className="text-[10px] font-bold uppercase mt-1">Topo #1</span>
          </div>
        </div>
      </div>

      {/* GRÁFICOS VISUAIS INTERATIVOS COM LEGENDAS LIMPAS (RECHARTS) */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico 1: Distribuição de Gastos por Categoria (Rosca / Pie) */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-purple-400" />
                Distribuição por Categoria
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Valores em R$</span>
            </div>

            {pieChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Sem despesas registradas no período selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieChartData.slice(0, 6).map((entry, index) => (
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
                          valuesHidden ? "••••••" : `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                          `${name}`
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda de Badges em Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                  {pieChartData.slice(0, 6).map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-1.5 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: CATEGORY_PIE_COLORS[idx % CATEGORY_PIE_COLORS.length] }} 
                      />
                      <span className="text-xs text-zinc-300 font-medium truncate">
                        {item.emoji} {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 2: Evolução Histórica de Gastos (Barras Amanda vs Gastão) */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Gastos Mensais (Amanda vs Gastão)
              </h3>
              <span className="text-[10px] text-zinc-400 font-mono uppercase">Valores em R$</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barTrendData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="Mês" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis 
                    tick={{ fill: "#9ca3af", fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false}
                    width={50}
                    tickFormatter={(val) => valuesHidden ? "" : (val >= 1000 ? `${(val/1000).toFixed(0)}k` : val)}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }}
                    labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                    formatter={(val: any) => [valuesHidden ? "••••••" : `R$ ${Number(val).toLocaleString('pt-BR')}`]}
                  />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, color: "#9ca3af" }} />
                  <Bar dataKey="Gastos Amanda" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos Gastão" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Categorias & Orçamento Resumo no Dashboard */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              Categorias & Orçamento Pessoal
            </h3>
            <p className="text-xs text-zinc-400">Clique em qualquer categoria para ver a lista detalhada de gastos abaixo.</p>
          </div>
          <Link href="/personal-categories" className="text-xs text-indigo-400 hover:underline font-semibold">
            Gerenciar Categorias & Emojis →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const catName = lang === 'pt' ? cat.namePt : cat.nameEs;
            const isSelected = selectedCategoryId === cat.id;

            const spentBRL = filteredTransactions
              .filter(t => t.type === 'expense' && matchesCategory(t.category, cat.namePt, cat.nameEs))
              .reduce((acc, t) => acc + toBRL(t.amount, t.currency), 0);

            const pct = Math.min(Math.round((spentBRL / (cat.limit || 1)) * 100), 100);

            return (
              <div 
                key={cat.id} 
                onClick={() => setSelectedCategoryId(prev => prev === cat.id ? null : cat.id)}
                className={`p-3.5 rounded-xl border space-y-2 cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/15' 
                    : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-base ${cat.color}`}>
                      {cat.emoji || "📂"}
                    </span>
                    <div>
                      <h4 className={`text-xs font-bold transition-colors ${isSelected ? 'text-purple-300' : 'text-white'}`}>{catName}</h4>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {valuesHidden 
                          ? "••••••" 
                          : `Gasto: R$ ${spentBRL.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / Meta: R$ ${cat.limit.toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-purple-300">{valuesHidden ? "••%" : `${pct}%`}</span>
                </div>

                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-purple-500'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>

                <div className="flex items-center justify-between pt-0.5 text-[10px]">
                  <span className={isSelected ? 'text-purple-300 font-bold' : 'text-zinc-500'}>
                    {isSelected ? '✓ Filtrando gastos abaixo' : 'Toque para ver gastos'}
                  </span>
                  {isSelected && (
                    <span className="text-purple-400 text-[10px] font-bold underline">Fechar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Painel Expansível com Todos os Gastos da Categoria Clicada */}
        {selectedCatObj && (
          <div className="mt-4 p-5 rounded-2xl border border-purple-500/40 bg-zinc-950 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl ${selectedCatObj.color}`}>
                  {selectedCatObj.emoji || "📂"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">
                      Gastos em {lang === 'pt' ? selectedCatObj.namePt : selectedCatObj.nameEs}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {selectedCategoryExpenses.length} {selectedCategoryExpenses.length === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Total no período: <strong className="text-white font-bold">{maskBRL(selectedCatSpentBRL)}</strong>
                    {selectedCatSpentARS > 0 && !valuesHidden && (
                      <span className="text-zinc-500 ml-1.5">($ {selectedCatSpentARS.toLocaleString('es-AR', { minimumFractionDigits: 0 })} ARS)</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCategoryId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold self-start sm:self-auto transition-all cursor-pointer"
              >
                <X size={14} />
                <span>Fechar lista</span>
              </button>
            </div>

            {/* Tabela de Lançamentos da Categoria */}
            {selectedCategoryExpenses.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
                Nenhum gasto registrado nesta categoria no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-800/80 max-h-[420px] overflow-y-auto scroll-thin">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/90 sticky top-0 text-zinc-400 uppercase font-semibold text-[10px] z-10">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Estabelecimento / Descrição</th>
                      <th className="p-3">Familiar</th>
                      <th className="p-3">Subcategoria</th>
                      <th className="p-3 text-right">Valor Original</th>
                      <th className="p-3 text-right">Valor em R$</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {selectedCategoryExpenses.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3 font-mono text-zinc-400 whitespace-nowrap">
                          {tx.date ? new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td className="p-3 font-medium text-white">
                          <div>{tx.merchant}</div>
                          {tx.description && tx.description !== tx.merchant && (
                            <div className="text-[10px] text-zinc-500 truncate max-w-xs">{tx.description}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {tx.childTag ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {parentsList.includes(tx.childTag) ? '👤 ' : '👶 '}
                              {tx.childTag}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-zinc-400">
                          {tx.subcategory || 'Geral'}
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-zinc-300 whitespace-nowrap">
                          {maskOrig(tx.amount, tx.currency)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          {maskBRL(toBRL(tx.amount, tx.currency))}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Editar lançamento"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de Transações Recentes Pessoais (Com Botão de Edição) */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-400" />
              Últimos Gastos & Despesas Pessoais ({filteredTransactions.filter(t => t.type === 'expense').length})
            </h3>
            <p className="text-xs text-zinc-400">Despesas reais consolidadas de Amanda, Gastão e Colégio Misericórdia.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Membro */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedMember('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedMember === 'all'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Amanda')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedMember === 'Amanda'
                    ? 'bg-pink-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                👤 Amanda
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Gastão')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedMember === 'Gastão'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                👤 Gastão
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Misericordia')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedMember === 'Misericordia'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🎒 Misericórdia
              </button>
            </div>

            {/* Anti-Inflação: Ocultar transferências entre casal */}
            <button
              type="button"
              onClick={() => setHideInternalTransfers(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                hideInternalTransfers
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Evita inflar os gastos reais com transferências de dinheiro entre Gastão e Amanda"
            >
              <span>{hideInternalTransfers ? '✓' : '○'}</span>
              <span>{hideInternalTransfers ? 'Sem Transf. entre Casal' : 'Com Transf. entre Casal'}</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition-all ml-auto sm:ml-0"
            >
              <Plus size={14} />
              <span>Novo Gasto</span>
            </button>
          </div>
        </div>

        <div>
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center space-y-2 rounded-xl border border-zinc-800 bg-zinc-950">
              <p className="text-xs font-bold text-zinc-400">Nenhum gasto ou receita no período selecionado</p>
              <p className="text-[11px] text-zinc-500">Altere o seletor de datas acima ou adicione um novo lançamento.</p>
            </div>
          ) : (
            <>
              {/* VERSÃO MOBILE E TABLET (CARDS RESPONSIVOS ABAIXO DE 768PX) */}
              <div className="block md:hidden space-y-3">
                {filteredTransactions.map((tx) => {
                  const catBadge = getCatBadgeInfo(tx.category);
                  const isParent = parentsList.includes(tx.childTag || '');

                  return (
                    <div key={tx.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white text-xs">{tx.merchant}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{tx.date || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono font-bold text-sm ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {valuesHidden ? '••••••' : `${tx.type === 'income' ? '+' : '-'}${tx.currency === 'ARS' ? `$ ${tx.amount.toLocaleString()}` : tx.currency === 'USD' ? `$ ${tx.amount.toFixed(2)}` : `R$ ${tx.amount.toFixed(2)}`}`}
                          </p>
                          <span className="text-[10px] font-mono font-bold text-zinc-400">
                            {tx.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium ${catBadge.color}`}>
                            <span>{catBadge.emoji}</span>
                            <span>{tx.category}</span>
                          </span>
                          {tx.subcategory && (
                            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-md">
                              {tx.subcategory}
                            </span>
                          )}

                          {tx.childTag && (
                            <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                              isParent 
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                                : "bg-pink-500/20 text-pink-300 border-pink-500/30"
                            }`}>
                              {isParent ? `👤 ${tx.childTag}` : `👶 ${tx.childTag}`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-400 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold px-2"
                          >
                            <Pencil size={12} />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-400 bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VERSÃO DESKTOP (TABELA RESPONSIVA COM ROLAGEM E LARGURAS FIXAS) */}
              <div className="hidden md:block overflow-x-auto max-h-[600px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner">
                <table className="w-full min-w-[750px] text-left text-xs text-zinc-300 border-collapse">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase font-semibold text-[10px] border-b border-zinc-800 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-28 whitespace-nowrap">Data</th>
                      <th className="p-3 min-w-[220px]">Estabelecimento / Descrição</th>
                      <th className="p-3 w-28 whitespace-nowrap">Moeda</th>
                      <th className="p-3 min-w-[160px] whitespace-nowrap">Categoria</th>
                      <th className="p-3 w-36 whitespace-nowrap">Vínculo Familiar</th>
                      <th className="p-3 w-36 text-right whitespace-nowrap">Valor Original</th>
                      <th className="p-3 w-20 text-center whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredTransactions.map((tx) => {
                      const catBadge = getCatBadgeInfo(tx.category);
                      const isParent = parentsList.includes(tx.childTag || '');

                      return (
                        <tr key={tx.id} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="p-3 font-mono text-zinc-400 whitespace-nowrap">
                            {tx.date || "-"}
                          </td>
                          <td className="p-3 max-w-md">
                            <p className="font-semibold text-white">{tx.merchant}</p>
                            {tx.description && <p className="text-[11px] text-zinc-500 truncate">{tx.description}</p>}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {tx.currency === 'ARS' && (
                              <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-bold text-[11px]">
                                ARS
                              </span>
                            )}
                            {tx.currency === 'BRL' && (
                              <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold text-[11px]">
                                BRL
                              </span>
                            )}
                            {tx.currency === 'USD' && (
                              <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono font-bold text-[11px]">
                                USD
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-medium ${catBadge.color}`}>
                              <span>{catBadge.emoji}</span>
                              <span>{tx.category}</span>
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {tx.childTag ? (
                              <span className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${
                                isParent 
                                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                                  : "bg-pink-500/20 text-pink-300 border-pink-500/30"
                              }`}>
                                {isParent ? `👤 ${tx.childTag}` : `👶 ${tx.childTag}`}
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {valuesHidden ? '••••••' : `${tx.type === 'income' ? '+' : '-'}${tx.currency === 'ARS' ? `$ ${tx.amount.toLocaleString()}` : tx.currency === 'USD' ? `$ ${tx.amount.toFixed(2)}` : `R$ ${tx.amount.toFixed(2)}`}`}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setEditingTx(tx)}
                                className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                title="Editar este lançamento"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Excluir este lançamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Editar Transação Pessoal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-4 sm:p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-400" />
                Editar Lançamento Pessoal
              </h3>
              <button onClick={() => setEditingTx(null)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateEditingTransaction} className="space-y-3">
              <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingTx({ ...editingTx, type: 'expense' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    editingTx.type === 'expense' ? 'bg-rose-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Despesa (Gasto)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTx({ ...editingTx, type: 'income' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    editingTx.type === 'income' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Receita (Pró-labore)
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Estabelecimento / Descrição</label>
                <input
                  type="text"
                  required
                  value={editingTx.merchant}
                  onChange={(e) => setEditingTx({ ...editingTx, merchant: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Valor</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={editingTx.amount}
                    onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Moeda</label>
                  <select
                    value={editingTx.currency}
                    onChange={(e) => setEditingTx({ ...editingTx, currency: e.target.value as Currency })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="ARS">$ ARS (Argentina)</option>
                    <option value="BRL">R$ BRL (Brasil)</option>
                    <option value="USD">$ USD (Dólar)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Data do Gasto</label>
                <input
                  type="date"
                  value={editingTx.date}
                  onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Categoria</label>
                  <select
                    value={editingTx.category}
                    onChange={(e) => {
                      const newCatName = e.target.value;
                      const catObj = categories.find(c => c.namePt === newCatName || c.nameEs === newCatName);
                      const defaultSub = catObj?.subcategories?.[0] || '';
                      setEditingTx({ ...editingTx, category: newCatName, subcategory: defaultSub });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
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
                  <label className="text-xs font-semibold text-zinc-400">Subcategoria</label>
                  <select
                    value={editingTx.subcategory || ''}
                    onChange={(e) => setEditingTx({ ...editingTx, subcategory: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">Geral / Nenhuma</option>
                    {(categories.find(c => c.namePt === editingTx.category || c.nameEs === editingTx.category)?.subcategories || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-purple-400">Vincular a Pessoa / Familiar</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: '' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      !editingTx.childTag
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                        : 'border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Nenhum
                  </button>

                  {parentsList.map((parent) => (
                    <button
                      key={parent}
                      type="button"
                      onClick={() => setEditingTx({ ...editingTx, childTag: parent })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editingTx.childTag === parent
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      👤 {parent}
                    </button>
                  ))}

                  {childrenList.map((child) => (
                    <button
                      key={child}
                      type="button"
                      onClick={() => setEditingTx({ ...editingTx, childTag: child })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editingTx.childTag === child
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
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Gasto Manualmente */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-4 sm:p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Tag size={13} className="text-purple-400" />
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCatName = e.target.value;
                      setCategory(newCatName);
                      const catObj = categories.find(c => c.namePt === newCatName || c.nameEs === newCatName);
                      setSubcategory(catObj?.subcategories?.[0] || '');
                    }}
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
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Tag size={13} className="text-purple-400" />
                    Subcategoria
                  </label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="">Geral / Nenhuma</option>
                    {(categories.find(c => c.namePt === category || c.nameEs === category)?.subcategories || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-purple-400 flex items-center gap-1">
                  <User size={13} className="text-purple-400" />
                  Vincular a Pessoa / Familiar
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

                  {/* Pais */}
                  {parentsList.map((parent) => (
                    <button
                      key={parent}
                      type="button"
                      onClick={() => setChildTag(parent)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        childTag === parent
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      👤 {parent}
                    </button>
                  ))}

                  {/* Filhos */}
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

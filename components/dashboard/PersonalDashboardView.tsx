"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { DICTIONARY } from "@/lib/i18n/dict";
import { Currency, RatesMap, convertAmount, formatCurrency, parseBrazilianCurrency, formatBrazilianNumber } from "@/lib/currency/format";
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
  Award,
  RefreshCw,
  Cloud,
  UploadCloud
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
  language?: 'pt' | 'es';
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
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", subcategories: ["Passeios em Família", "Cinema & Shows", "Assinaturas (Netflix/Spotify)", "Viagens", "Vinho"], limit: 2000, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", emoji: "🥳" },
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

function deduplicateTransactions(list: any[]): any[] {
  const seen = new Set<string>();
  const clean: any[] = [];
  for (const tx of list) {
    if (!tx || !tx.id) continue;
    const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const key = `${tx.id}_${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(tx);
    }
  }
  return clean;
}

interface PersonalDashboardViewProps {
  displayCurrency?: Currency;
  rate?: RatesMap;
  initialTransactions?: PersonalTransaction[];
  initialCategories?: CustomCategory[];
  currentUser?: {
    email: string;
    name: string;
    role: "Amanda" | "Gastão";
  };
}

export default function PersonalDashboardView({
  displayCurrency: propCurrency = "BRL",
  rate: propRate,
  initialTransactions,
  initialCategories,
  currentUser,
}: PersonalDashboardViewProps = {}) {
  const { lang } = useProfile();
  const { hidden: valuesHidden } = useValuesVisibility();
  const dict = DICTIONARY[lang];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Moeda ativa selecionada no topo (BRL, USD ou ARS)
  const [activeCurrency, setActiveCurrency] = useState<Currency>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("display_currency") as Currency;
      if (saved && ["BRL", "USD", "ARS"].includes(saved)) return saved;
    }
    return (propCurrency as Currency) || "BRL";
  });

  // Cotação ao vivo da internet (DolarApi / BCRA / ExchangeRate-API)
  const [liveRates, setLiveRates] = useState<{
    arsPerBrlOficial: number;
    arsPerBrlBlue: number;
    source: string;
    fetchedAt: string;
  } | null>(null);

  const [isAutoRate, setIsAutoRate] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("pf_ars_rate_mode");
      return mode !== "manual";
    }
    return true;
  });

  // Cotação real Pesos/Real em uso (inicia em 300.35 Dólar Blue e atualiza via API da internet)
  const [customArsPerBrl, setCustomArsPerBrl] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("pf_ars_rate_mode");
      const saved = localStorage.getItem("pf_custom_ars_brl");
      if (mode === "manual" && saved && !isNaN(Number(saved)) && Number(saved) > 0) {
        return Number(saved);
      }
    }
    return 300.35;
  });

  // Busca cotação oficial da internet automaticamente ao carregar
  useEffect(() => {
    let isMounted = true;
    async function loadLiveRates() {
      try {
        const res = await fetch("/api/currency/rates");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.rates && isMounted) {
            setLiveRates({
              arsPerBrlOficial: data.rates.arsPerBrlOficial,
              arsPerBrlBlue: data.rates.arsPerBrlBlue,
              source: data.source || "DolarApi",
              fetchedAt: data.fetchedAt || new Date().toISOString()
            });

            // Se o usuário estiver no modo automático (padrão), sincroniza com o Dólar Blue (câmbio real de mercado: 300.35)
            const mode = localStorage.getItem("pf_ars_rate_mode");
            if (mode !== "manual") {
              const effectiveRate = data.rates.arsPerBrlBlue || data.rates.arsPerBrl || 300.35;
              setCustomArsPerBrl(effectiveRate);
              setIsAutoRate(true);
            }
          }
        }
      } catch (err) {
        console.warn("Falha ao buscar cotação ao vivo da internet:", err);
      }
    }
    loadLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (propCurrency && ["BRL", "USD", "ARS"].includes(propCurrency)) {
      setActiveCurrency(propCurrency);
    }
  }, [propCurrency]);

  useEffect(() => {
    const handleCurrencyChange = (e: any) => {
      const newCurr = (e.detail || e) as Currency;
      if (newCurr && ["BRL", "USD", "ARS"].includes(newCurr)) {
        setActiveCurrency(newCurr);
      }
    };
    window.addEventListener("currency-change", handleCurrencyChange);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "display_currency" && e.newValue && ["BRL", "USD", "ARS"].includes(e.newValue)) {
        setActiveCurrency(e.newValue as Currency);
      }
      if (e.key === "pf_custom_ars_brl" && e.newValue && !isNaN(Number(e.newValue))) {
        setCustomArsPerBrl(Number(e.newValue));
      }
      if (e.key === "pf_ars_rate_mode") {
        setIsAutoRate(e.newValue !== "manual");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("currency-change", handleCurrencyChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const convertToActive = (amount: number, fromCurr: Currency): number => {
    const usdBrl = propRate?.usd_brl || 5.87;
    const usdArs = usdBrl * customArsPerBrl;
    return convertAmount(amount, fromCurr, activeCurrency, { usd_brl: usdBrl, usd_ars: usdArs });
  };

  const toBRL = (amount: number, fromCurr: Currency): number => {
    const usdBrl = propRate?.usd_brl || 5.87;
    const usdArs = usdBrl * customArsPerBrl;
    return convertAmount(amount, fromCurr, "BRL", { usd_brl: usdBrl, usd_ars: usdArs });
  };

  const formatMoney = (amount: number, curr: Currency = activeCurrency): string => {
    if (valuesHidden) return "••••••";
    return formatCurrency(amount, curr);
  };

  const maskBRL = (val: number) => {
    if (valuesHidden) return "••••••";
    return formatCurrency(val, activeCurrency);
  };

  const maskOrig = (amount: number, curr: Currency, sign: string = '') => {
    if (valuesHidden) return "••••••";
    return `${sign}${formatCurrency(amount, curr)}`;
  };

  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>(() => {
    if (initialTransactions && initialTransactions.length > 0) {
      return initialTransactions;
    }
    return (DEMO_PERSONAL_TRANSACTIONS || []).map(t => ({
      ...t,
      type: (t.type || 'expense') as 'expense' | 'income',
      language: (t.language || 'es') as 'pt' | 'es'
    })) as PersonalTransaction[];
  });
  const [categories, setCategories] = useState<CustomCategory[]>(
    initialCategories && initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES
  );
  const [childrenList, setChildrenList] = useState<string[]>(["Bernardo"]);
  const [parentsList, setParentsList] = useState<string[]>(["Gastão", "Amanda"]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [hideInternalTransfers, setHideInternalTransfers] = useState<boolean>(true);
  const [showOnlyExpenses, setShowOnlyExpenses] = useState<boolean>(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Sincroniza estado se initialTransactions mudar via SSR
  useEffect(() => {
    if (initialTransactions && initialTransactions.length > 0) {
      setTransactions((prev) => deduplicateTransactions([...initialTransactions, ...prev]));
    }
  }, [initialTransactions]);

  // Modo do gráfico de evolução: 'total' (Consolidado), 'stacked' (Empilhado), 'split' (Separado Amanda vs Gastão)
  const [chartMode, setChartMode] = useState<'total' | 'stacked' | 'split'>('total');

  // Edit modal state
  const [editingTx, setEditingTx] = useState<PersonalTransaction | null>(null);
  const [editingAmountRaw, setEditingAmountRaw] = useState<string>('');

  // Manual Form State - default titular vem do usuário logado (Amanda ou Gastão)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [amountRaw, setAmountRaw] = useState<string>('');
  const [txCurrency, setTxCurrency] = useState<Currency>('ARS');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Alimentação & Supermercado');
  const [subcategory, setSubcategory] = useState('');
  const [childTag, setChildTag] = useState<string>(currentUser?.role || '');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const loadAllPersonalData = async () => {
      const builtinTxs: any[] = DEMO_PERSONAL_TRANSACTIONS || [];
      const baseTxs = initialTransactions && initialTransactions.length > 0 ? initialTransactions : builtinTxs;

      // 1. Verifica se há transações criadas offline neste aparelho no localStorage
      let localOnlyTxs: any[] = [];
      const savedTxs = localStorage.getItem('user_personal_transactions');
      if (savedTxs) {
        try {
          const parsed = JSON.parse(savedTxs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const baseIds = new Set(baseTxs.map((t: any) => t.id));
            localOnlyTxs = parsed.filter((t: any) => t && t.id && !baseIds.has(t.id));
          }
        } catch (e) {}
      }

      let localCats: any[] = [];
      const storedCats = localStorage.getItem('personal_custom_categories');
      if (storedCats) {
        try {
          const parsed = JSON.parse(storedCats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localCats = parsed;
          }
        } catch (e) {}
      }

      // 2. Sincroniza bidirecionalmente com o banco Neon PostgreSQL na nuvem!
      // Envia eventuais anotações locais offline e recebe todos os dados unificados de Amanda e Gastão
      try {
        setIsCloudSyncing(true);
        const res = await fetch('/api/personal/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            localTransactions: localOnlyTxs,
            localCategories: localCats.length > 0 ? localCats : undefined
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            const dbCustom = json.customTransactions || [];
            const deletedSet = new Set(json.deletedIds || []);

            // Junta os customizados da nuvem com os históricos de base
            const allMerged = [...dbCustom, ...builtinTxs].filter((t: any) => !deletedSet.has(t.id));
            const finalDeduped: PersonalTransaction[] = deduplicateTransactions(allMerged).map((t: any) => ({
              ...t,
              type: (t.type || 'expense') as 'expense' | 'income',
              language: (t.language || 'es') as 'pt' | 'es'
            }));

            setTransactions(finalDeduped);
            localStorage.setItem('user_personal_transactions', JSON.stringify(finalDeduped));
            setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

            // Sincroniza membros
            const foundMembers = Array.from(new Set(finalDeduped.map(t => t.childTag || t.parentTag).filter(Boolean))) as string[];
            if (foundMembers.length > 0) {
              setParentsList(prev => Array.from(new Set([...prev, "Gastão", "Amanda", ...foundMembers])));
            }
          }
        }
      } catch (err) {
        console.warn('Sincronização em nuvem offline, usando dados já carregados:', err);
      } finally {
        setIsCloudSyncing(false);
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

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await fetch('/api/personal/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          localTransactions: transactions,
          localCategories: categories
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const dbCustom = json.customTransactions || [];
          const deletedSet = new Set(json.deletedIds || []);
          const builtinTxs: any[] = DEMO_PERSONAL_TRANSACTIONS || [];
          const allMerged = [...dbCustom, ...builtinTxs].filter((t: any) => !deletedSet.has(t.id));
          const finalDeduped: PersonalTransaction[] = deduplicateTransactions(allMerged).map((t: any) => ({
            ...t,
            type: (t.type || 'expense') as 'expense' | 'income',
            language: (t.language || 'es') as 'pt' | 'es'
          }));

          setTransactions(finalDeduped);
          localStorage.setItem('user_personal_transactions', JSON.stringify(finalDeduped));
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (e) {
      console.warn('Erro ao sincronizar manualmente com a nuvem:', e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleOpenEditModal = (tx: PersonalTransaction) => {
    setEditingTx(tx);
    setEditingAmountRaw(formatBrazilianNumber(tx.amount));
  };

  const handleAddManualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = parseBrazilianCurrency(amountRaw) || amount;
    const newTx: PersonalTransaction = {
      id: `tx-pf-${Date.now()}`,
      date,
      merchant,
      description,
      amount: finalAmount,
      currency: txCurrency,
      type,
      category,
      childTag: childTag || undefined,
      language: lang
    };
    const updated = [newTx, ...transactions];
    saveTransactions(updated);

    // Persiste imediatamente no Neon PostgreSQL para sincronizar com Amanda e Gastão
    fetch('/api/personal/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', transaction: newTx })
    }).catch(console.warn);

    setShowManualModal(false);

    // Reset
    setMerchant('');
    setDescription('');
    setAmount(0);
    setAmountRaw('');
    setChildTag('');
  };

  const handleUpdateEditingTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const finalAmount = parseBrazilianCurrency(editingAmountRaw) || editingTx.amount;
    const updatedTx: PersonalTransaction = {
      ...editingTx,
      amount: finalAmount
    };

    const updated = transactions.map(t => (t.id === updatedTx.id ? updatedTx : t));
    saveTransactions(updated);

    // Atualiza imediatamente na nuvem
    fetch('/api/personal/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', transaction: updatedTx })
    }).catch(console.warn);

    setEditingTx(null);
    setEditingAmountRaw('');
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    saveTransactions(updated);

    // Remove imediatamente da nuvem e adiciona à lista de excluídos
    fetch('/api/personal/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    }).catch(console.warn);
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

  const getMemberBadge = (tag?: string) => {
    if (!tag) return null;
    const t = tag.toLowerCase().trim();
    if (t === 'amanda' || (t.includes('amanda') && !t.includes('gast'))) {
      return {
        label: `👩 ${tag}`,
        style: "bg-pink-500/20 text-pink-300 border-pink-500/30"
      };
    }
    if (t === 'gastão' || t === 'gastao' || (t.includes('gast') && !t.includes('amanda'))) {
      return {
        label: `👨 ${tag}`,
        style: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
      };
    }
    if (t.includes('filho') || t.includes('bernardo')) {
      return {
        label: `🎒 ${tag}`,
        style: "bg-amber-500/20 text-amber-300 border-amber-500/30"
      };
    }
    return {
      label: `👥 ${tag}`,
      style: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    };
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

  // Helpers de classificação familiar unificada
  const isSchoolOrChildrenTx = (t: PersonalTransaction) => {
    const tag = (t.childTag || t.parentTag || '').toLowerCase();
    const d = ((t.description || '') + ' ' + (t.merchant || '') + ' ' + (t.category || '')).toLowerCase();
    return (
      tag.includes('filho') ||
      tag.includes('bernardo') ||
      t.category === 'Filhos & Família' ||
      d.includes('misericordia') ||
      d.includes('asociacion hijas') ||
      d.includes('all boys') ||
      d.includes('futebol') ||
      d.includes('pelicula') ||
      d.includes('campeonato')
    );
  };

  const isAmandaTx = (t: PersonalTransaction) => {
    const tag = (t.childTag || t.parentTag || '').toLowerCase();
    return (tag === 'amanda' || tag.startsWith('amanda')) && !tag.includes('gast');
  };

  const isGastaoTx = (t: PersonalTransaction) => {
    const tag = (t.childTag || t.parentTag || '').toLowerCase();
    return (tag === 'gastão' || tag === 'gastao' || tag.startsWith('gast')) && !tag.includes('amanda');
  };

  const isSharedOrHouseholdTx = (t: PersonalTransaction) => {
    if (isSchoolOrChildrenTx(t)) return false;
    if (isAmandaTx(t)) return false;
    if (isGastaoTx(t)) return false;
    return true;
  };

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

    if (selectedMember === 'Amanda') {
      const tag = (t.childTag || t.parentTag || '').toLowerCase();
      return tag === 'amanda' || tag.includes('amanda');
    }

    if (selectedMember === 'Gastão') {
      const tag = (t.childTag || t.parentTag || '').toLowerCase();
      return tag === 'gastão' || tag === 'gastao' || tag.includes('gastão') || tag.includes('gastao');
    }

    if (selectedMember === 'Filhos' || selectedMember === 'Misericordia') {
      return isSchoolOrChildrenTx(t);
    }

    if (selectedMember === 'Casa' || selectedMember === 'Compartilhado') {
      return isSharedOrHouseholdTx(t);
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
    .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

  const totalExpensesARS = filteredTransactions
    .filter(t => t.type === 'expense' && t.currency === 'ARS')
    .reduce((acc, t) => acc + t.amount, 0);

  // Gastos Amanda no período
  const amandaExpenses = filteredTransactions.filter(t => t.type === 'expense' && isAmandaTx(t));
  const amandaExpensesBRL = amandaExpenses.reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);
  const amandaExpensesARS = amandaExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);
  const amandaTxCount = amandaExpenses.length;

  // Gastos Gastão no período
  const gastaoExpenses = filteredTransactions.filter(t => t.type === 'expense' && isGastaoTx(t));
  const gastaoExpensesBRL = gastaoExpenses.reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);
  const gastaoExpensesARS = gastaoExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);
  const gastaoTxCount = gastaoExpenses.length;

  // Gastos Escola & Filhos (Colegio Misericordia + Futebol All Boys) no período
  const schoolExpenses = filteredTransactions.filter(t => t.type === 'expense' && isSchoolOrChildrenTx(t));
  const schoolExpensesBRL = schoolExpenses.reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);
  const schoolExpensesARS = schoolExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);

  // Gastos Compartilhados / Casa & Família (Supermercado, Luz, Água, Aluguel, Ambos)
  const sharedExpenses = filteredTransactions.filter(t => t.type === 'expense' && isSharedOrHouseholdTx(t));
  const sharedExpensesBRL = sharedExpenses.reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);
  const sharedExpensesARS = sharedExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);

  // Total combinado dos titulares (Amanda + Gastão)
  const totalTitularesBRL = amandaExpensesBRL + gastaoExpensesBRL;
  const totalTitularesARS = amandaExpensesARS + gastaoExpensesARS;

  // -------------------------------------------------------------
  // CÁLCULO COMPARATIVO MÊS A MÊS (MoM)
  // -------------------------------------------------------------
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthYear = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthYear) && (!hideInternalTransfers || !t.isInternalTransfer))
    .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

  const prevMonthExpensesBRL = transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(prevMonthYear) && (!hideInternalTransfers || !t.isInternalTransfer))
    .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

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
      categorySpendingMap[catName] = (categorySpendingMap[catName] || 0) + convertToActive(t.amount, t.currency);
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
      const val = convertToActive(curr.amount, curr.currency);
      const maxVal = max ? convertToActive(max.amount, max.currency) : 0;
      return val > maxVal ? curr : max;
    }, null);

  const topSingleExpenseBRL = topSingleExpense
    ? convertToActive(topSingleExpense.amount, topSingleExpense.currency)
    : 0;

  // Categoria atualmente selecionada pelo clique do usuário
  const selectedCatObj = categories.find(c => c.id === selectedCategoryId) || null;
  const selectedCategoryExpenses = selectedCatObj
    ? filteredTransactions.filter(t => t.type === 'expense' && matchesCategory(t.category, selectedCatObj.namePt, selectedCatObj.nameEs))
    : [];
  const selectedCatSpentBRL = selectedCategoryExpenses.reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);
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

    const val = convertToActive(t.amount, t.currency);
    const tag = (t.childTag || t.parentTag || '').toLowerCase();
    if (tag === 'amanda' || (tag.includes('amanda') && !tag.includes('gast'))) {
      monthlyDataMap[key].amanda += val;
    } else if (tag === 'gastão' || tag === 'gastao' || (tag.includes('gast') && !tag.includes('amanda'))) {
      monthlyDataMap[key].gastao += val;
    } else {
      monthlyDataMap[key].amanda += val / 2;
      monthlyDataMap[key].gastao += val / 2;
    }
    monthlyDataMap[key].total += val;
  });

  const barTrendData = Object.values(monthlyDataMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map(d => ({
      Mês: d.monthLabel,
      "Gastos Amanda": Math.round(d.amanda),
      "Gastos Gastão": Math.round(d.gastao),
      "Total Consolidado": Math.round(d.total),
      Total: Math.round(d.total)
    }));

  const avgMonthlyTotal = barTrendData.length > 0 
    ? Math.round(barTrendData.reduce((acc, d) => acc + d["Total Consolidado"], 0) / barTrendData.length) 
    : 0;

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const total = data["Total Consolidado"] || data.Total || 0;
    const amanda = data["Gastos Amanda"] || 0;
    const gastao = data["Gastos Gastão"] || 0;
    const amandaPct = total > 0 ? ((amanda / total) * 100).toFixed(0) : "0";
    const gastaoPct = total > 0 ? ((gastao / total) * 100).toFixed(0) : "0";

    return (
      <div className="bg-zinc-950 border border-zinc-700 p-3 rounded-xl shadow-2xl space-y-2 min-w-[220px]">
        <div className="border-b border-zinc-800 pb-1.5 flex justify-between items-center">
          <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
          <span className="text-[10px] text-zinc-500 font-mono">{activeCurrency}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-white bg-purple-500/15 border border-purple-500/30 px-2.5 py-1.5 rounded-lg">
            <span className="flex items-center gap-1.5 text-purple-300">
              💳 Total da Família:
            </span>
            <span className="font-mono text-purple-200">
              {valuesHidden ? '••••••' : formatMoney(total)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-300 px-1 pt-0.5">
            <span className="flex items-center gap-1.5 text-pink-400">
              <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
              Amanda:
            </span>
            <span className="font-mono">
              {valuesHidden ? '••••••' : formatMoney(amanda)} <span className="text-zinc-500 text-[10px]">({amandaPct}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-300 px-1">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              Gastão:
            </span>
            <span className="font-mono">
              {valuesHidden ? '••••••' : formatMoney(gastao)} <span className="text-zinc-500 text-[10px]">({gastaoPct}%)</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Banner Superior com Ações */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950 via-zinc-900 to-indigo-950 p-6 rounded-2xl border border-purple-500/20 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {dict.dashboard.title}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Cloud size={12} />
              <span>Nuvem Unificada (Amanda & Gastão)</span>
            </span>
            {currentUser && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                currentUser.role === 'Amanda'
                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}>
                <span>{currentUser.role === 'Amanda' ? '👩' : '👨'}</span>
                <span>Conectado como: {currentUser.name || currentUser.role}</span>
              </span>
            )}
            {lastSyncTime && (
              <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                • Sincronizado às {lastSyncTime}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-300">
            Acompanhe o controle financeiro pessoal, despesas dos titulares e dependentes familiares.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleManualCloudSync}
            disabled={isCloudSyncing}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs border transition-all ${
              isCloudSyncing
                ? "bg-purple-900/50 border-purple-500/50 text-purple-200 animate-pulse"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
            }`}
            title="Sincronizar todas as anotações de Amanda e Gastão com o banco na nuvem"
          >
            <RefreshCw size={14} className={isCloudSyncing ? "animate-spin text-purple-400" : "text-emerald-400"} />
            <span>{isCloudSyncing ? "Sincronizando..." : "Sincronizar Nuvem"}</span>
          </button>

          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all w-full sm:w-auto"
          >
            <Sparkles size={15} />
            <span>Escanear Comprovante / Extrato</span>
          </Link>

          <button
            onClick={() => {
              setAmountRaw('');
              setAmount(0);
              setMerchant('');
              setDescription('');
              setChildTag(currentUser?.role || '');
              setShowManualModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-all w-full sm:w-auto"
          >
            <Plus size={15} />
            <span>Lançar Manualmente</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE DATAS IDÊNTICO AO DA EMPRESA (PERIODBAR) */}
      <PeriodBar from={from} to={to}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-zinc-400 font-mono">
            Exibindo <strong className="text-purple-300">{filteredTransactions.length}</strong> de {transactions.length} lançamentos
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-xs">
            <span className="text-zinc-400">💱 Câmbio Blue:</span>
            <span className="font-mono font-bold text-amber-300">
              1 R$ = {typeof customArsPerBrl === 'number' ? (Number.isInteger(customArsPerBrl) ? customArsPerBrl : customArsPerBrl.toFixed(2)) : customArsPerBrl} ARS
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
              isAutoRate 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
            }`}>
              {isAutoRate ? "🌐 Dólar Blue Ao Vivo" : "✏️ Manual"}
            </span>
            <button
              type="button"
              onClick={() => {
                const oficialStr = liveRates?.arsPerBrlOficial ? `${liveRates.arsPerBrlOficial} ARS` : "291.99 ARS";
                const blueStr = liveRates?.arsPerBrlBlue ? `${liveRates.arsPerBrlBlue} ARS` : "300.35 ARS";
                const promptMsg = `Cotações da Internet em tempo real:
• Câmbio Oficial Blue (Dia a dia): ${blueStr}
• Banco Central BCRA Oficial: ${oficialStr}

Digite o valor desejado (ou digite 'auto' para usar o Dólar Blue ao vivo da internet):`;
                const input = prompt(promptMsg, isAutoRate ? "auto" : String(customArsPerBrl));
                if (input !== null) {
                  const cleaned = input.trim().toLowerCase();
                  if (cleaned === "auto" || cleaned === "blue" || cleaned === "") {
                    localStorage.removeItem("pf_custom_ars_brl");
                    localStorage.setItem("pf_ars_rate_mode", "auto");
                    setIsAutoRate(true);
                    if (liveRates?.arsPerBrlBlue) {
                      setCustomArsPerBrl(liveRates.arsPerBrlBlue);
                    }
                  } else if (cleaned === "oficial") {
                    const rate = liveRates?.arsPerBrlOficial || 291.99;
                    localStorage.setItem("pf_custom_ars_brl", String(rate));
                    localStorage.setItem("pf_ars_rate_mode", "manual");
                    setIsAutoRate(false);
                    setCustomArsPerBrl(rate);
                  } else {
                    const val = parseFloat(cleaned.replace(',', '.'));
                    if (!isNaN(val) && val > 0) {
                      localStorage.setItem("pf_custom_ars_brl", String(val));
                      localStorage.setItem("pf_ars_rate_mode", "manual");
                      setIsAutoRate(false);
                      setCustomArsPerBrl(val);
                    }
                  }
                }
              }}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-0.5"
              title="Ajustar ou alternar cotação oficial da internet"
            >
              <Pencil size={11} />
            </button>
          </div>

          {/* Destaque do Total Geral no Seletor de Período */}
          <div className="flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 px-3 py-1 rounded-lg text-xs shadow-sm">
            <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">Total de Gastos:</span>
            <span className="font-mono font-bold text-rose-400 text-sm">{maskBRL(totalExpensesBRL)}</span>
            {activeCurrency !== 'ARS' && totalExpensesARS > 0 && !valuesHidden && (
              <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                ($ {totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS)
              </span>
            )}
          </div>
        </div>
      </PeriodBar>

      {/* Cards de Métricas Principais (Foco em Despesas Reais) - NO TOPO DO DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Despesas Família */}
        <div className="p-4 sm:p-5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/30 shadow-lg shadow-rose-950/20 space-y-2 ring-1 ring-rose-500/20">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px] text-rose-300 flex items-center gap-1">
              <span>💳</span> Total Família
            </span>
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-400 tracking-tight">
            {maskBRL(totalExpensesBRL)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-0.5">
            <span>
              {valuesHidden ? '••••••' : `$ ${totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`}
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-sans font-semibold">
              {filteredTransactions.filter(t => t.type === 'expense').length} txs
            </span>
          </div>
        </div>

        {/* Gastos Amanda */}
        <div className="p-4 sm:p-5 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-zinc-900 to-pink-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-pink-300">👩 Amanda</span>
            <div className="p-1.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-pink-400">
            {maskBRL(amandaExpensesBRL)}
          </p>
          <p className="text-[10px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${amandaExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({amandaTxCount} txs)
          </p>
        </div>

        {/* Gastos Gastão */}
        <div className="p-4 sm:p-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-zinc-900 to-indigo-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-300">👨 Gastão</span>
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-indigo-400">
            {maskBRL(gastaoExpensesBRL)}
          </p>
          <p className="text-[10px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${gastaoExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({gastaoTxCount} txs)
          </p>
        </div>

        {/* Escola & Filhos (Colegio Misericordia + Futebol All Boys) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-amber-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-300">🎒 Filhos & Colégio</span>
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Baby className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
            {maskBRL(schoolExpensesBRL)}
          </p>
          <p className="text-[10px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${schoolExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({schoolExpenses.length} txs)
          </p>
        </div>

        {/* Casa & Compartilhado */}
        <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900 to-emerald-950/20 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-300">🏠 Casa & Compartilhado</span>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            {maskBRL(sharedExpensesBRL)}
          </p>
          <p className="text-[10px] text-zinc-400 font-mono">
            {valuesHidden ? '••••••' : `$ ${sharedExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`} ({sharedExpenses.length} txs)
          </p>
        </div>
      </div>

      {/* Grid das Pessoas Titulares e Filhos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: Titulares */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gastos dos Titulares</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold font-mono">
                Total Titulares: {maskBRL(totalTitularesBRL)}
              </span>
            </div>
          </div>

          {parentsList.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-center space-y-1">
              <p className="text-xs font-semibold text-zinc-400">Nenhum titular cadastrado ainda</p>
              <p className="text-[11px] text-zinc-500">Cadastre os titulares nas configurações para atribuir gastos individualmente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {parentsList.map((parent) => {
                const parentExpensesActive = filteredTransactions
                  .filter(t => t.childTag === parent && t.type === 'expense')
                  .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

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
                      {maskBRL(parentExpensesActive)}
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full font-bold font-mono">
                Total Filhos: {maskBRL(schoolExpensesBRL)}
              </span>
              <Link href="/settings" className="text-[10px] text-indigo-400 hover:underline font-semibold">
                Gerenciar Filhos →
              </Link>
            </div>
          </div>

          {childrenList.length === 0 ? (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>🎒</span> Colegio Misericordia (Escola)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {filteredTransactions.filter(t => (t.merchant || '').includes('Misericordia') || (t.description || '').toLowerCase().includes('asociacion hijas')).length} mensalidades
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold font-mono text-pink-400">
                    {maskBRL(filteredTransactions.filter(t => (t.merchant || '').includes('Misericordia') || (t.description || '').toLowerCase().includes('asociacion hijas')).reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0))}
                  </p>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {valuesHidden ? '••••••' : `$ ${filteredTransactions.filter(t => (t.merchant || '').includes('Misericordia') || (t.description || '').toLowerCase().includes('asociacion hijas')).reduce((acc, t) => acc + t.amount, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Mensalidades escolares dos filhos no período selecionado
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <span>⚽</span> All Boys (Futebol do Filho)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {filteredTransactions.filter(t => (t.merchant || '').includes('All Boys') || (t.description || '').toLowerCase().includes('all boys')).length} pagamentos
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold font-mono text-emerald-400">
                    {maskBRL(filteredTransactions.filter(t => (t.merchant || '').includes('All Boys') || (t.description || '').toLowerCase().includes('all boys')).reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0))}
                  </p>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {valuesHidden ? '••••••' : `$ ${filteredTransactions.filter(t => (t.merchant || '').includes('All Boys') || (t.description || '').toLowerCase().includes('all boys')).reduce((acc, t) => acc + t.amount, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Escolinha e treinos de futebol do filho em Saavedra
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {childrenList.map((child) => {
                const childExpensesActive = filteredTransactions
                  .filter(t => t.childTag === child && t.type === 'expense')
                  .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

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
                      {maskBRL(childExpensesActive)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
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
                  -{formatMoney(Math.abs(momExpensesDiffBRL))} (-{Math.abs(momExpensesPct).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 font-mono">
                  <TrendingUp size={16} />
                  +{formatMoney(momExpensesDiffBRL)} (+{momExpensesPct.toFixed(1)}%)
                </span>
              )}
            </p>
            <p className="text-[11px] text-zinc-400">
              {valuesHidden ? (
                "Variação dos gastos em relação ao mês anterior."
              ) : (
                `Variação dos gastos em relação ao mês anterior (Mês Atual: ${maskBRL(currentMonthExpensesBRL)} vs Mês Anterior: ${maskBRL(prevMonthExpensesBRL)}).`
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
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Valores em {activeCurrency}</span>
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
                          valuesHidden ? "••••••" : formatMoney(Number(val)),
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

          {/* Gráfico 2: Evolução Histórica de Gastos (Consolidado / Empilhado / Separado) */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  Evolução dos Gastos Mensais
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {chartMode === 'total' 
                    ? 'Visualizando gastos totais consolidados da família' 
                    : chartMode === 'stacked'
                    ? 'Visualizando gastos empilhados (Amanda + Gastão = Total)'
                    : 'Visualizando comparativo lado a lado (Amanda vs Gastão)'}
                </p>
              </div>

              {/* Seletor de Modo de Visualização do Gráfico */}
              <div className="flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 text-[11px] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartMode('total')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartMode === 'total' 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Ver o gasto total consolidado da casa somado em uma única barra"
                >
                  Total Consolidado
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('stacked')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartMode === 'stacked' 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Barras empilhadas onde a altura total representa o gasto completo do mês"
                >
                  Empilhado
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('split')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    chartMode === 'split' 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Comparar gastos individuais de Amanda e Gastão lado a lado"
                >
                  Separado
                </button>
              </div>
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
                  <RechartsTooltip content={<CustomBarTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, color: "#9ca3af" }} />
                  {chartMode === 'total' && (
                    <Bar dataKey="Total Consolidado" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Gasto Total da Família" />
                  )}
                  {chartMode === 'stacked' && (
                    <>
                      <Bar dataKey="Gastos Amanda" stackId="gastos" fill="#ec4899" name="Gastos Amanda" />
                      <Bar dataKey="Gastos Gastão" stackId="gastos" fill="#6366f1" radius={[6, 6, 0, 0]} name="Gastos Gastão" />
                    </>
                  )}
                  {chartMode === 'split' && (
                    <>
                      <Bar dataKey="Gastos Amanda" fill="#ec4899" radius={[4, 4, 0, 0]} name="Gastos Amanda" />
                      <Bar dataKey="Gastos Gastão" fill="#6366f1" radius={[4, 4, 0, 0]} name="Gastos Gastão" />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Média Mensal Consolidada:
                <strong className="text-white font-mono">{maskBRL(avgMonthlyTotal)}</strong>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Valores em {activeCurrency}</span>
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

            const spentActive = filteredTransactions
              .filter(t => t.type === 'expense' && matchesCategory(t.category, cat.namePt, cat.nameEs))
              .reduce((acc, t) => acc + convertToActive(t.amount, t.currency), 0);

            const limitActive = convertToActive(cat.limit, 'BRL');
            const pct = Math.min(Math.round((spentActive / (limitActive || 1)) * 100), 100);

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
                          : `Gasto: ${formatMoney(spentActive)} / Meta: ${formatMoney(limitActive)}`}
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
                      <th className="p-3 text-right">Valor em {activeCurrency}</th>
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
                          {formatMoney(convertToActive(tx.amount, tx.currency))}
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
                  <tfoot className="bg-zinc-900/95 sticky bottom-0 border-t-2 border-purple-500/40 text-white font-bold z-10 shadow-md">
                    <tr>
                      <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-[10px] text-zinc-300">
                        Total da Categoria ({selectedCategoryExpenses.length} lançamentos):
                      </td>
                      <td className="p-3 text-right font-mono text-xs text-zinc-400 whitespace-nowrap">
                        {selectedCatSpentARS > 0 && !valuesHidden ? `$ ${selectedCatSpentARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS` : '—'}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-400 text-sm whitespace-nowrap">
                        {maskBRL(selectedCatSpentBRL)}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de Transações Recentes Pessoais (Com Botão de Edição) */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <span>Últimos Gastos & Despesas Pessoais</span>
              </h3>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/25">
                Total: {maskBRL(totalExpensesBRL)}
                {activeCurrency !== 'ARS' && totalExpensesARS > 0 && !valuesHidden && (
                  <span className="text-[10px] text-zinc-400 ml-1.5 font-normal">
                    ($ {totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS)
                  </span>
                )}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                ({filteredTransactions.filter(t => t.type === 'expense').length} despesas)
              </span>
            </div>
            <p className="text-xs text-zinc-400">Despesas reais consolidadas de Amanda, Gastão e Colégio Misericórdia.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Membro */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedMember('all')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedMember === 'all'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos (Consolidado)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Amanda')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedMember === 'Amanda'
                    ? 'bg-pink-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                👩 Amanda
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Gastão')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedMember === 'Gastão'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                👨 Gastão
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Filhos')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedMember === 'Filhos' || selectedMember === 'Misericordia'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🎒 Filhos & Colégio
              </button>
              <button
                type="button"
                onClick={() => setSelectedMember('Casa')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  selectedMember === 'Casa' || selectedMember === 'Compartilhado'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🏠 Casa & Compartilhado
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
              onClick={() => {
                setAmountRaw('');
                setAmount(0);
                setMerchant('');
                setDescription('');
                setChildTag(currentUser?.role || '');
                setShowManualModal(true);
              }}
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
                {/* Banner de Total de Gastos no Topo da Lista Mobile */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-rose-500/30 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">Total de Gastos no Período</p>
                    <p className="text-xs text-zinc-500">{filteredTransactions.filter(t => t.type === 'expense').length} despesas filtradas</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-base text-rose-400">{maskBRL(totalExpensesBRL)}</p>
                    {activeCurrency !== 'ARS' && totalExpensesARS > 0 && !valuesHidden && (
                      <p className="text-[10px] font-mono text-zinc-400">
                        $ {totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS
                      </p>
                    )}
                  </div>
                </div>

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
                            {valuesHidden ? '••••••' : `${tx.type === 'income' ? '+' : '-'}${formatMoney(convertToActive(tx.amount, tx.currency))}`}
                          </p>
                          {tx.currency !== activeCurrency ? (
                            <span className="text-[10px] font-mono text-zinc-500 block">
                              orig. {formatCurrency(tx.amount, tx.currency)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-zinc-400">
                              {tx.currency}
                            </span>
                          )}
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

                          {(() => {
                            const badge = getMemberBadge(tx.childTag);
                            if (!badge) return null;
                            return (
                              <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${badge.style}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleOpenEditModal(tx)}
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

                {/* Banner de Total Acumulado no Rodapé da Lista Mobile */}
                <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                    Total Acumulado ({filteredTransactions.filter(t => t.type === 'expense').length} despesas):
                  </span>
                  <div className="text-right font-mono font-bold text-rose-400">
                    <div>{maskBRL(totalExpensesBRL)}</div>
                    {activeCurrency !== 'ARS' && totalExpensesARS > 0 && !valuesHidden && (
                      <div className="text-[10px] text-zinc-400 font-normal">
                        $ {totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* VERSÃO DESKTOP (TABELA RESPONSIVA COM ROLAGEM E LARGURAS FIXAS) */}
              <div className="hidden md:block overflow-x-auto max-h-[600px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner">
                <table className="w-full min-w-[750px] text-left text-xs text-zinc-300 border-collapse">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase font-semibold text-[10px] border-b border-zinc-800 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-28 whitespace-nowrap">Data</th>
                      <th className="p-3 min-w-[220px]">Estabelecimento / Descrição</th>
                      <th className="p-3 w-28 whitespace-nowrap">Moeda Orig.</th>
                      <th className="p-3 min-w-[160px] whitespace-nowrap">Categoria</th>
                      <th className="p-3 w-36 whitespace-nowrap">Vínculo Familiar</th>
                      <th className="p-3 w-36 text-right whitespace-nowrap">Valor ({activeCurrency})</th>
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
                            {(() => {
                              const badge = getMemberBadge(tx.childTag);
                              if (!badge) return <span className="text-zinc-600">-</span>;
                              return (
                                <span className={`px-2.5 py-0.5 rounded-full font-bold border text-[11px] ${badge.style}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <div>{valuesHidden ? '••••••' : `${tx.type === 'income' ? '+' : '-'}${formatMoney(convertToActive(tx.amount, tx.currency))}`}</div>
                            {tx.currency !== activeCurrency && (
                              <div className="text-[10px] font-normal text-zinc-500 font-mono">
                                orig. {formatCurrency(tx.amount, tx.currency)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditModal(tx)}
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
                  <tfoot className="bg-zinc-900/95 backdrop-blur-sm border-t-2 border-zinc-700 sticky bottom-0 text-white font-bold z-10 shadow-lg">
                    <tr>
                      <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-[11px] text-zinc-300">
                        Total de Gastos Filtrados ({filteredTransactions.filter(t => t.type === 'expense').length} despesas):
                      </td>
                      <td className="p-3 text-right font-mono text-rose-400 text-sm whitespace-nowrap">
                        <div>{maskBRL(totalExpensesBRL)}</div>
                        {activeCurrency !== 'ARS' && totalExpensesARS > 0 && !valuesHidden && (
                          <div className="text-[10px] font-normal text-zinc-400 font-mono">
                            $ {totalExpensesARS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ARS
                          </div>
                        )}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
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
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="Ex: 10.000,00"
                    value={editingAmountRaw}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingAmountRaw(val);
                      setEditingTx({ ...editingTx, amount: parseBrazilianCurrency(val) });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-zinc-500">Padrão BR: 10.000,00</span>
                    {editingTx.amount > 0 && (
                      <span className="text-emerald-400 font-mono font-bold">
                        ✓ {formatMoney(editingTx.amount, editingTx.currency)}
                      </span>
                    )}
                  </div>
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-400 flex items-center justify-between">
                  <span>Vincular a Pessoa / Familiar</span>
                  {editingTx.childTag && (
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Atribuído: <strong className="text-white">{editingTx.childTag}</strong>
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: 'Amanda' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      editingTx.childTag === 'Amanda'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👩</span>
                    <span>Amanda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: 'Gastão' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      editingTx.childTag === 'Gastão'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👨</span>
                    <span>Gastão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: 'Amanda e Gastão' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      editingTx.childTag === 'Amanda e Gastão' || editingTx.childTag === 'Casal'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👥</span>
                    <span>Ambos / Casal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: 'Filhos & Família' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      editingTx.childTag === 'Filhos & Família' || editingTx.childTag === 'Bernardo'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>🎒</span>
                    <span>Bernardo / Filhos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: 'Família / Casa' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      editingTx.childTag === 'Família / Casa' || editingTx.childTag === 'Casa'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>🏠</span>
                    <span>Casa & Geral</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...editingTx, childTag: '' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      !editingTx.childTag
                        ? 'bg-zinc-700 text-white border-zinc-600'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>📦</span>
                    <span>Sem titular</span>
                  </button>
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
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="Ex: 10.000,00"
                    value={amountRaw}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmountRaw(val);
                      setAmount(parseBrazilianCurrency(val));
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-purple-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-zinc-500">Padrão BR: 10.000,00</span>
                    {amount > 0 && (
                      <span className="text-emerald-400 font-mono font-bold">
                        ✓ {formatMoney(amount, txCurrency)}
                      </span>
                    )}
                  </div>
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <User size={13} className="text-purple-400" />
                    Quem gastou? (Titular / Destino)
                  </span>
                  {childTag && (
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Atribuído: <strong className="text-white">{childTag}</strong>
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setChildTag('Amanda')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      childTag === 'Amanda'
                        ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👩</span>
                    <span>Amanda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChildTag('Gastão')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      childTag === 'Gastão'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👨</span>
                    <span>Gastão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChildTag('Amanda e Gastão')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      childTag === 'Amanda e Gastão' || childTag === 'Casal'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>👥</span>
                    <span>Ambos / Casal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChildTag('Filhos & Família')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      childTag === 'Filhos & Família' || childTag === 'Bernardo'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>🎒</span>
                    <span>Bernardo / Filhos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChildTag('Família / Casa')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      childTag === 'Família / Casa' || childTag === 'Casa'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>🏠</span>
                    <span>Casa & Geral</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChildTag('')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-1.5 ${
                      !childTag
                        ? 'bg-zinc-700 text-white border-zinc-600'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>📦</span>
                    <span>Sem titular</span>
                  </button>
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

'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { DICTIONARY } from '@/lib/i18n/dict';
import { 
  CreditCard as CardIcon, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Receipt, 
  Calendar, 
  DollarSign, 
  Building2, 
  Tag, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';

export interface CreditCardItem {
  id: string;
  name: string;
  bank: string;
  currency: 'ARS' | 'BRL' | 'USD';
  closingDay: number;
  dueDay: number;
  limit: number;
  baseInvoice: number;
  color: string;
}

export interface CardTransaction {
  id: string;
  cardId: string;
  date: string;
  merchant: string;
  amount: number;
  currency: 'ARS' | 'BRL' | 'USD';
  installments?: string;
  category: string;
}

const COLOR_THEMES = [
  { name: "Galicia Laranja", class: "from-amber-600 to-orange-700", bgDot: "bg-orange-500" },
  { name: "Nubank Roxo", class: "from-purple-600 to-indigo-800", bgDot: "bg-purple-600" },
  { name: "Black / Dark", class: "from-zinc-800 to-zinc-950", bgDot: "bg-zinc-800" },
  { name: "Verde Esmeralda", class: "from-emerald-600 to-teal-800", bgDot: "bg-emerald-600" },
  { name: "Azul Ocean", class: "from-blue-600 to-cyan-800", bgDot: "bg-blue-600" },
  { name: "Rose Gold", class: "from-rose-500 to-pink-700", bgDot: "bg-rose-500" },
  { name: "Dourado Premium", class: "from-yellow-600 to-amber-700", bgDot: "bg-yellow-500" }
];

const INITIAL_CARDS: CreditCardItem[] = [
  {
    id: "card-galicia",
    name: "Tarjeta Visa Signature",
    bank: "Banco Galicia (Argentina)",
    currency: "ARS",
    closingDay: 24,
    dueDay: 5,
    limit: 3500000,
    baseInvoice: 0,
    color: "from-amber-600 to-orange-700"
  },
  {
    id: "card-nubank",
    name: "Cartão Nubank Ultravioleta",
    bank: "Nubank (Brasil)",
    currency: "BRL",
    closingDay: 15,
    dueDay: 22,
    limit: 25000,
    baseInvoice: 0,
    color: "from-purple-600 to-indigo-800"
  }
];

export default function CreditCardsPage() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [cards, setCards] = useState<CreditCardItem[]>(INITIAL_CARDS);
  const [cardTxs, setCardTxs] = useState<CardTransaction[]>([]);
  
  // Modal State for Card Creation/Edit
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'BRL' | 'USD'>('ARS');
  const [closingDay, setClosingDay] = useState<number>(20);
  const [dueDay, setDueDay] = useState<number>(5);
  const [limit, setLimit] = useState<number>(5000);
  const [baseInvoice, setBaseInvoice] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState(COLOR_THEMES[0].class);

  // Modal State for Transaction/Purchase
  const [showTxModal, setShowTxModal] = useState(false);
  const [targetCardId, setTargetCardId] = useState<string>('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txMerchant, setTxMerchant] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txCategory, setTxCategory] = useState('Alimentação & Supermercado');
  const [txInstallments, setTxInstallments] = useState('À vista');

  // Load Data
  useEffect(() => {
    const loadCardsData = () => {
      const storedCards = localStorage.getItem('user_personal_credit_cards');
      if (storedCards) {
        try {
          const parsed = JSON.parse(storedCards);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCards(parsed);
          } else {
            setCards(INITIAL_CARDS);
          }
        } catch (e) {}
      } else {
        localStorage.setItem('user_personal_credit_cards', JSON.stringify(INITIAL_CARDS));
      }

      const storedTxs = localStorage.getItem('user_personal_card_transactions');
      if (storedTxs) {
        try {
          setCardTxs(JSON.parse(storedTxs));
        } catch (e) {}
      }
    };

    loadCardsData();

    window.addEventListener('user_pf_data_changed', loadCardsData);
    window.addEventListener('storage', loadCardsData);

    return () => {
      window.removeEventListener('user_pf_data_changed', loadCardsData);
      window.removeEventListener('storage', loadCardsData);
    };
  }, []);

  const saveCards = (updated: CreditCardItem[]) => {
    setCards(updated);
    localStorage.setItem('user_personal_credit_cards', JSON.stringify(updated));
    window.dispatchEvent(new Event('user_pf_data_changed'));
  };

  const saveCardTransactions = (updated: CardTransaction[]) => {
    setCardTxs(updated);
    localStorage.setItem('user_personal_card_transactions', JSON.stringify(updated));
    window.dispatchEvent(new Event('user_pf_data_changed'));
  };

  // Card Handlers
  const handleOpenAddCardModal = () => {
    setEditingCardId(null);
    setName('');
    setBank('');
    setCurrency('ARS');
    setClosingDay(20);
    setDueDay(5);
    setLimit(1000000);
    setBaseInvoice(0);
    setSelectedColor(COLOR_THEMES[0].class);
    setShowCardModal(true);
  };

  const handleOpenEditCardModal = (card: CreditCardItem) => {
    setEditingCardId(card.id);
    setName(card.name);
    setBank(card.bank);
    setCurrency(card.currency);
    setClosingDay(card.closingDay);
    setDueDay(card.dueDay);
    setLimit(card.limit);
    setBaseInvoice(card.baseInvoice || 0);
    setSelectedColor(card.color || COLOR_THEMES[0].class);
    setShowCardModal(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCardId) {
      const updated = cards.map(c => 
        c.id === editingCardId 
          ? {
              ...c,
              name,
              bank,
              currency,
              closingDay,
              dueDay,
              limit,
              baseInvoice,
              color: selectedColor
            }
          : c
      );
      saveCards(updated);
    } else {
      const newCard: CreditCardItem = {
        id: `card-${Date.now()}`,
        name,
        bank,
        currency,
        closingDay,
        dueDay,
        limit,
        baseInvoice,
        color: selectedColor
      };
      saveCards([...cards, newCard]);
    }

    setShowCardModal(false);
  };

  const handleDeleteCard = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cartão de crédito?")) {
      const updated = cards.filter(c => c.id !== id);
      saveCards(updated);

      // Limpar transações do cartão excluído
      const updatedTxs = cardTxs.filter(t => t.cardId !== id);
      saveCardTransactions(updatedTxs);
    }
  };

  // Transaction Handlers
  const handleOpenTxModal = (cardId?: string) => {
    setTargetCardId(cardId || (cards[0]?.id || ''));
    setTxMerchant('');
    setTxAmount(0);
    setTxInstallments('À vista');
    setTxDate(new Date().toISOString().split('T')[0]);
    setShowTxModal(true);
  };

  const handleSaveCardTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCardId) return;

    const selectedCard = cards.find(c => c.id === targetCardId);
    const newTx: CardTransaction = {
      id: `card-tx-${Date.now()}`,
      cardId: targetCardId,
      date: txDate,
      merchant: txMerchant,
      amount: txAmount,
      currency: selectedCard ? selectedCard.currency : 'ARS',
      installments: txInstallments,
      category: txCategory
    };

    const updated = [newTx, ...cardTxs];
    saveCardTransactions(updated);
    setShowTxModal(false);
  };

  const handleDeleteCardTx = (id: string) => {
    const updated = cardTxs.filter(t => t.id !== id);
    saveCardTransactions(updated);
  };

  // Restauar cartões de teste padrão
  const handleResetDefaultCards = () => {
    if (confirm("Deseja restaurar os cartões de crédito e faturas padrão de teste?")) {
      localStorage.setItem('user_personal_credit_cards', JSON.stringify(INITIAL_CARDS));
      localStorage.removeItem('user_personal_card_transactions');
      window.dispatchEvent(new Event('user_pf_data_changed'));
      alert("Cartões restaurados com sucesso!");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CardIcon className="w-6 h-6 text-indigo-400" />
            {dict.creditCards.title}
          </h2>
          <p className="text-sm text-zinc-400">
            {dict.creditCards.subtitle} — Edite limites, valores de faturas, datas de fechamento e lance compras
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleResetDefaultCards}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-all border border-zinc-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>Restaurar Cartões Padrão</span>
          </button>

          <button
            onClick={() => handleOpenTxModal()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 text-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Lançar Compra no Cartão</span>
          </button>

          <button
            onClick={handleOpenAddCardModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Cartão</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => {
          // Calculate total invoice = baseInvoice + sum of card transactions for this card
          const cardPurchasesSum = cardTxs
            .filter(t => t.cardId === card.id)
            .reduce((sum, t) => sum + t.amount, 0);

          const currentInvoiceTotal = (card.baseInvoice || 0) + cardPurchasesSum;
          const percentLimitUsed = Math.min(Math.round((currentInvoiceTotal / (card.limit || 1)) * 100), 100);
          const thisCardTxs = cardTxs.filter(t => t.cardId === card.id);

          return (
            <div key={card.id} className="space-y-4">
              {/* Credit Card Visual Element */}
              <div className={`p-6 rounded-2xl bg-gradient-to-br ${card.color || 'from-purple-600 to-indigo-800'} shadow-xl border border-white/10 text-white space-y-6 relative overflow-hidden group`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/70 font-semibold">{card.bank}</p>
                    <h3 className="text-lg font-extrabold">{card.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full font-mono font-bold">
                      {card.currency}
                    </span>
                    <button
                      onClick={() => handleOpenEditCardModal(card)}
                      title="Editar cartão / limite / fatura"
                      className="p-1.5 bg-black/20 hover:bg-white/20 rounded-lg transition-colors text-white"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      title="Excluir cartão"
                      className="p-1.5 bg-black/20 hover:bg-rose-500/40 rounded-lg transition-colors text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-white/70">{dict.creditCards.currentInvoice}</p>
                    <button
                      onClick={() => handleOpenEditCardModal(card)}
                      className="text-[11px] underline text-white/80 hover:text-white font-semibold"
                    >
                      ✏️ Editar Valor da Fatura
                    </button>
                  </div>
                  <p className="text-3xl font-extrabold font-mono tracking-tight">
                    {card.currency === 'ARS' ? `$ ${currentInvoiceTotal.toLocaleString()}` : `R$ ${currentInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs text-white/80 pt-2 border-t border-white/10">
                  <div>
                    <span>{dict.creditCards.closingDay}: </span>
                    <strong className="text-white">Dia {card.closingDay}</strong>
                  </div>
                  <div>
                    <span>{dict.creditCards.dueDate}: </span>
                    <strong className="text-white">Dia {card.dueDay}</strong>
                  </div>
                </div>
              </div>

              {/* Progress & Limit Card */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2 text-xs">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>{dict.creditCards.limit}: <strong className="text-white font-mono">{card.currency === 'ARS' ? `$ ${card.limit.toLocaleString()}` : `R$ ${card.limit.toLocaleString()}`}</strong></span>
                  <span className="font-bold text-zinc-300 font-mono">{percentLimitUsed}% usado</span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      percentLimitUsed > 80 ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${percentLimitUsed}%` }}
                  />
                </div>
              </div>

              {/* Purchases / Transactions on Card */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Receipt size={14} className="text-purple-400" />
                    Lançamentos na Fatura ({thisCardTxs.length})
                  </h4>
                  <button
                    onClick={() => handleOpenTxModal(card.id)}
                    className="text-[11px] font-bold text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Adicionar Compra</span>
                  </button>
                </div>

                {thisCardTxs.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic text-center py-2">
                    Nenhuma compra lançada neste cartão ainda.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {thisCardTxs.map(tx => (
                      <div key={tx.id} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>{tx.merchant}</span>
                            {tx.installments && (
                              <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                                {tx.installments}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">{tx.date} • {tx.category}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-400">
                            {tx.currency === 'ARS' ? `$ ${tx.amount.toLocaleString()}` : `R$ ${tx.amount.toFixed(2)}`}
                          </span>
                          <button
                            onClick={() => handleDeleteCardTx(tx.id)}
                            className="text-zinc-500 hover:text-rose-400 p-1"
                            title="Excluir gasto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Criar / Editar Cartão */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CardIcon className="w-5 h-5 text-indigo-400" />
                {editingCardId ? "Editar Cartão de Crédito" : "Novo Cartão de Crédito"}
              </h3>
              <button onClick={() => setShowCardModal(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Nome do Cartão</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tarjeta Visa Signature, Cartão Nubank Ultravioleta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Banco / Emissor</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Banco Galicia, Nubank, Itaú, Santander"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Moeda da Fatura</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="ARS">$ ARS (Argentina)</option>
                    <option value="BRL">R$ BRL (Brasil)</option>
                    <option value="USD">$ USD (Dólar)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Limite Total do Cartão</label>
                  <input
                    type="number"
                    required
                    step="100"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-indigo-400 font-semibold">Valor da Fatura Atual (R$ / ARS)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={baseInvoice}
                  onChange={(e) => setBaseInvoice(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-indigo-500/50 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                />
                <p className="text-[11px] text-zinc-500">Ajuste o valor fixo atual da fatura deste cartão.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Dia de Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={closingDay}
                    onChange={(e) => setClosingDay(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dueDay}
                    onChange={(e) => setDueDay(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Color Theme Selector Grid */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Cor do Cartão 🎨</label>
                <div className="flex flex-wrap gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.name}
                      type="button"
                      onClick={() => setSelectedColor(theme.class)}
                      title={theme.name}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        selectedColor === theme.class
                          ? 'border-white bg-zinc-800 text-white shadow-md'
                          : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${theme.bgDot}`} />
                      <span>{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Salvar Cartão</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Compra no Cartão */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
                Lançar Compra no Cartão
              </h3>
              <button onClick={() => setShowTxModal(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCardTx} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Selecione o Cartão</label>
                <select
                  value={targetCardId}
                  onChange={(e) => setTargetCardId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-purple-500 outline-none"
                >
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Building2 size={13} className="text-purple-400" />
                  Estabelecimento / Loja
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coto, Mercado Livre, Amazon, Uber, Farmacity"
                  value={txMerchant}
                  onChange={(e) => setTxMerchant(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <DollarSign size={13} className="text-purple-400" />
                    Valor da Compra
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={txAmount || ''}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Parcelas</label>
                  <select
                    value={txInstallments}
                    onChange={(e) => setTxInstallments(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-purple-500 outline-none"
                  >
                    <option value="À vista">À vista (1x)</option>
                    <option value="2x">2x parcelado</option>
                    <option value="3x">3x parcelado</option>
                    <option value="6x">6x parcelado</option>
                    <option value="12x">12x parcelado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Calendar size={13} className="text-purple-400" />
                  Data da Compra
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <Tag size={13} className="text-purple-400" />
                  Categoria
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="Alimentação & Supermercado">🍕 Alimentação & Supermercado</option>
                  <option value="Filhos & Família">👦 Filhos & Família</option>
                  <option value="Lazer & Entretenimento">🥳 Lazer & Entretenimento</option>
                  <option value="Moradia & Serviços">🏠 Moradia & Serviços</option>
                  <option value="Saúde & Bem-Estar">💊 Saúde & Bem-Estar</option>
                  <option value="Transporte & Veículo">🚗 Transporte & Veículo</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Salvar Compra</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

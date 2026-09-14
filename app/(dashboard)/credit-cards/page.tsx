'use client';

import React from 'react';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { DICTIONARY } from '@/lib/i18n/dict';
import { CreditCard as CardIcon } from 'lucide-react';

const CARDS = [
  {
    id: "card-galicia",
    name: "Tarjeta Visa Signature (Galicia Argentina)",
    bank: "Banco Galicia",
    currency: "ARS",
    closingDay: 24,
    dueDay: 5,
    limit: 3500000,
    currentInvoice: 642000,
    color: "from-amber-600 to-orange-700"
  },
  {
    id: "card-nubank",
    name: "Cartão Nubank Ultravioleta (Brasil)",
    bank: "Nubank",
    currency: "BRL",
    closingDay: 15,
    dueDay: 22,
    limit: 25000,
    currentInvoice: 4180.50,
    color: "from-purple-600 to-indigo-800"
  }
];

export default function CreditCardsPage() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CardIcon className="w-6 h-6 text-indigo-400" />
          {dict.creditCards.title}
        </h2>
        <p className="text-sm text-zinc-400">
          {dict.creditCards.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card) => (
          <div key={card.id} className="space-y-4">
            <div className={`p-6 rounded-2xl bg-gradient-to-br ${card.color} shadow-xl border border-white/10 text-white space-y-6 relative overflow-hidden`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/70 font-semibold">{card.bank}</p>
                  <h3 className="text-lg font-extrabold">{card.name}</h3>
                </div>
                <span className="text-xs bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full font-mono font-bold">
                  {card.currency}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-white/70">{dict.creditCards.currentInvoice}</p>
                <p className="text-3xl font-extrabold font-mono tracking-tight">
                  {card.currency === 'ARS' ? `$ ${card.currentInvoice.toLocaleString()}` : `R$ ${card.currentInvoice.toFixed(2)}`}
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

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>{dict.creditCards.limit}</span>
                <span className="font-mono font-bold text-white">
                  {card.currency === 'ARS' ? `$ ${card.limit.toLocaleString()}` : `R$ ${card.limit.toLocaleString()}`}
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(card.currentInvoice / card.limit) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

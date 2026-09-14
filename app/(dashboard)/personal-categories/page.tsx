'use client';

import React from 'react';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { DICTIONARY } from '@/lib/i18n/dict';
import { 
  PieChart as PieIcon, 
  Baby, 
  Utensils, 
  Sparkles, 
  Home, 
  HeartPulse, 
  Car,
  AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", icon: Baby, limit: 3500, spent: 2850, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", icon: Utensils, limit: 4500, spent: 3420, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", icon: Sparkles, limit: 2000, spent: 1200, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", icon: Home, limit: 5000, spent: 4100, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", icon: HeartPulse, limit: 2500, spent: 1840, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", icon: Car, limit: 1800, spent: 1450, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
];

export default function PersonalCategoriesPage() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <PieIcon className="w-6 h-6 text-indigo-400" />
          {dict.categories.title}
        </h2>
        <p className="text-sm text-zinc-400">
          {dict.categories.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const name = lang === 'pt' ? cat.namePt : cat.nameEs;
          const percentUsed = Math.min(Math.round((cat.spent / cat.limit) * 100), 100);

          return (
            <div key={cat.id} className="p-5 rounded-2xl border border-zinc-800 space-y-4 bg-zinc-900/60 hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${cat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{name}</h3>
                    <p className="text-xs text-zinc-400">
                      Limite: <strong className="text-zinc-200">R$ {cat.limit.toLocaleString()}</strong>
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  percentUsed > 80 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {percentUsed}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      percentUsed > 80
                        ? 'bg-gradient-to-r from-rose-500 to-red-600'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-400 font-mono">
                  <span>R$ {cat.spent.toLocaleString()} {dict.categories.spentOfLimit}</span>
                  <span>R$ {cat.limit.toLocaleString()}</span>
                </div>
              </div>

              {percentUsed > 80 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Atenção: Você atingiu {percentUsed}% do limite mensal nesta categoria.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

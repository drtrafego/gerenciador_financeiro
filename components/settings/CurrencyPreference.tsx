"use client";

import { useState, useTransition } from "react";
import { updateDisplayCurrency } from "@/server/actions/settings";
import { useRouter } from "next/navigation";
import type { Currency } from "@/lib/currency/format";

const CURRENCIES = [
  { code: "BRL" as Currency, label: "Real Brasileiro",  symbol: "R$" },
  { code: "USD" as Currency, label: "Dólar Americano",  symbol: "$"  },
  { code: "ARS" as Currency, label: "Peso Argentino",   symbol: "$"  },
];

export default function CurrencyPreference({ current }: { current: Currency }) {
  const [selected, setSelected] = useState<Currency>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      await updateDisplayCurrency(selected);
      router.refresh();
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-1">Moeda de Exibição do Dashboard</p>
      <p className="text-xs text-zinc-500 mb-4">
        Todos os valores serão convertidos para a moeda selecionada.
      </p>
      <div className="flex flex-col gap-2 mb-4">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setSelected(c.code)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left w-full
              ${selected === c.code
                ? "border-indigo-500 bg-indigo-600/10"
                : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"}`}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${selected === c.code ? "border-indigo-500" : "border-zinc-600"}`}
            >
              {selected === c.code && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{c.code} — {c.label}</p>
              <p className="text-xs text-zinc-500">Símbolo: {c.symbol}</p>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={pending || selected === current}
        className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-40"
      >
        {pending ? "Salvando..." : "Salvar Preferência"}
      </button>
    </div>
  );
}

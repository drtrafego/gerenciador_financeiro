"use client";

import { useOptimistic, useTransition } from "react";
import { updateDisplayCurrency } from "@/server/actions/settings";

export default function CurrencySelector({ defaultCurrency = "BRL" }: { defaultCurrency?: string }) {
  const [currency, setOptimistic] = useOptimistic(defaultCurrency);
  const [, startTransition] = useTransition();

  const handleChange = (c: string) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("display_currency", c);
        document.cookie = `display_currency=${c}; path=/; max-age=31536000`;
        window.dispatchEvent(new CustomEvent("currency-change", { detail: c }));
      } catch (e) {}
    }
    startTransition(async () => {
      setOptimistic(c);
      await updateDisplayCurrency(c);
    });
  };

  return (
    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
      {["BRL", "USD", "ARS"].map((c) => (
        <button
          key={c}
          onClick={() => handleChange(c)}
          className={`h-10 md:h-6 px-3 flex items-center justify-center rounded-md text-xs font-medium transition-all ${
            currency === c
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

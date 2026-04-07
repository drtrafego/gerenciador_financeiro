"use client";

import { Bell, Eye, EyeOff } from "lucide-react";
import { usePathname } from "next/navigation";
import CurrencySelector from "@/components/shared/CurrencySelector";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

const titles: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/clients":      "Clientes",
  "/contracts":    "Contratos",
  "/invoices":     "Faturas",
  "/cash-flow":    "Fluxo de Caixa",
  "/transactions": "Transações",
  "/settings":     "Configurações",
};

export default function Header({ displayCurrency = "BRL" }: { displayCurrency?: "BRL" | "USD" | "ARS" }) {
  const path = usePathname();
  const title = Object.entries(titles).find(([k]) => path.startsWith(k))?.[1] ?? "";
  const { hidden, toggle } = useValuesVisibility();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
      <h1 className="text-sm font-semibold text-zinc-200">{title}</h1>
      <div className="flex items-center gap-2">
        <CurrencySelector defaultCurrency={displayCurrency} />
        <button
          onClick={toggle}
          title={hidden ? "Mostrar valores" : "Ocultar valores"}
          className={`p-1.5 rounded-lg transition-colors ${
            hidden
              ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button className="relative text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}

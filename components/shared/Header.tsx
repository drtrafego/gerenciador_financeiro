"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import CurrencySelector from "@/components/shared/CurrencySelector";

const titles: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/clients":    "Clientes",
  "/contracts":  "Contratos",
  "/invoices":   "Faturas",
  "/cash-flow":  "Fluxo de Caixa",
  "/transactions": "Transações",
  "/settings":   "Configurações",
};

export default function Header({ displayCurrency = "BRL" }: { displayCurrency?: "BRL" | "USD" | "ARS" }) {
  const path = usePathname();
  const title = Object.entries(titles).find(([k]) => path.startsWith(k))?.[1] ?? "";

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
      <h1 className="text-sm font-semibold text-zinc-200">{title}</h1>
      <div className="flex items-center gap-3">
        <CurrencySelector defaultCurrency={displayCurrency} />
        <button className="relative text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}

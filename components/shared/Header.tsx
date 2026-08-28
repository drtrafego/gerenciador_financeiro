"use client";

import { useEffect, useRef } from "react";
import { Eye, EyeOff, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import CurrencySelector from "@/components/shared/CurrencySelector";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";

const titles: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/clients":      "Clientes",
  "/contracts":    "Contratos",
  "/invoices":     "Faturas",
  "/cash-flow":    "Fluxo de Caixa",
  "/transactions": "Transações",
  "/reminders":    "Lembretes WhatsApp",
  "/settings":     "Configurações",
};

export default function Header({ displayCurrency = "BRL" }: { displayCurrency?: "BRL" | "USD" | "ARS" }) {
  const path = usePathname();
  const title = Object.entries(titles).find(([k]) => path.startsWith(k))?.[1] ?? "";
  const { hidden, toggle } = useValuesVisibility();
  const { mobileOpen, toggleMobile } = useSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Ao fechar o drawer, o foco volta para o hambúrguer que o abriu.
  useEffect(() => {
    if (wasOpen.current && !mobileOpen) triggerRef.current?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  return (
    <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <button
          ref={triggerRef}
          onClick={toggleMobile}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          aria-controls="sidebar-nav"
          className="md:hidden -ml-1.5 w-10 h-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-sm font-semibold text-zinc-200 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <CurrencySelector defaultCurrency={displayCurrency} />
        {/* 40x40 no celular, o mesmo alvo do hambúrguer. A partir de md volta o
            28x28 de hoje, que era o que o p-1.5 dava, então o header não engorda
            no computador. */}
        <button
          onClick={toggle}
          title={hidden ? "Mostrar valores" : "Ocultar valores"}
          className={`flex h-10 w-10 md:h-7 md:w-7 items-center justify-center rounded-lg transition-colors ${
            hidden
              ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </header>
  );
}

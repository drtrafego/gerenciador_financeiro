"use client";

import { useEffect, useRef } from "react";
import { Eye, EyeOff, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import CurrencySelector from "@/components/shared/CurrencySelector";
import ProfileSwitcher from "@/components/shared/ProfileSwitcher";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useProfile } from "@/lib/contexts/ProfileContext";

const titles: Record<string, string> = {
  "/dashboard":           "Dashboard",
  "/clients":             "Clientes",
  "/contracts":           "Contratos",
  "/invoices":            "Faturas",
  "/cash-flow":           "Fluxo de Caixa",
  "/transactions":        "Transações",
  "/reminders":           "Lembretes WhatsApp",
  "/settings":            "Configurações",
  "/scan":                "Escanear Comprovante (IA)",
  "/personal-categories": "Categorias & Metas Pessoais",
  "/credit-cards":        "Cartões de Crédito (ARS/BRL)",
};

export default function Header({ displayCurrency = "BRL" }: { displayCurrency?: "BRL" | "USD" | "ARS" }) {
  const path = usePathname();
  const title = Object.entries(titles).find(([k]) => path.startsWith(k))?.[1] ?? "";
  const { hidden, toggle } = useValuesVisibility();
  const { mobileOpen, toggleMobile } = useSidebar();
  const { mode } = useProfile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !mobileOpen) triggerRef.current?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  return (
    <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur gap-2 flex-wrap sm:flex-nowrap">
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
        <h1 className="text-sm font-semibold text-zinc-200 truncate flex items-center gap-2">
          {title}
          {mode === "pf" && (
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              Modo Pessoal
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Seletor de Perfil PJ vs PF */}
        <ProfileSwitcher />

        <CurrencySelector defaultCurrency={displayCurrency} />

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

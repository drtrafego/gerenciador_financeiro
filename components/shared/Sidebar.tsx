"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  FileText, 
  ArrowLeftRight, 
  Bell, 
  Settings, 
  Menu, 
  X,
  Sparkles,
  PieChart,
  CreditCard,
  Receipt,
  Baby,
  Building2,
  Home,
  Globe
} from "lucide-react";
import { UserButton } from "@stackframe/stack";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useProfile } from "@/lib/contexts/ProfileContext";

const navPJ = [
  { href: "/dashboard",    label: "Dashboard Empresa", icon: LayoutDashboard },
  { href: "/clients",      label: "Clientes",           icon: Users },
  { href: "/contracts",    label: "Contratos",          icon: ClipboardList },
  { href: "/invoices",     label: "Faturas",            icon: FileText },
  { href: "/cash-flow",    label: "Fluxo de Caixa",     icon: ArrowLeftRight },
  { href: "/reminders",    label: "Lembretes WhatsApp", icon: Bell },
  { href: "/settings",     label: "Configurações",      icon: Settings },
];

const navPF = [
  { href: "/dashboard",           label: "Visão Geral Pessoal", icon: LayoutDashboard },
  { href: "/scan",                label: "Escanear Foto/Print", icon: Sparkles, badge: "IA" },
  { href: "/personal-categories", label: "Categorias & Metas",  icon: PieChart },
  { href: "/credit-cards",        label: "Cartões (ARS/BRL)",   icon: CreditCard },
  { href: "/settings",            label: "Configurações",       icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const path = usePathname();
  const router = useRouter();
  const { mobileOpen, closeMobile } = useSidebar();
  const { mode, setMode, lang, setLang } = useProfile();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState(true);

  const nav = mode === "pf" ? navPF : navPJ;

  const handleSwitchMode = (newMode: "pj" | "pf") => {
    setMode(newMode);
    router.push("/dashboard");
  };

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    closeMobile();
  }, [path, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  useEffect(() => {
    if (mobileOpen) closeBtnRef.current?.focus();
  }, [mobileOpen]);

  const drawerHidden = !isDesktop && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      <aside
        id="sidebar-nav"
        aria-label="Menu principal"
        inert={drawerHidden}
        aria-hidden={drawerHidden || undefined}
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:inset-auto md:z-auto md:translate-x-0 md:flex-shrink-0 md:transition-all ${
          open ? "md:w-60" : "md:w-16"
        } bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden`}
      >
        {/* Logo + Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-md ${
            mode === "pf" ? "bg-gradient-to-tr from-purple-600 to-pink-600" : "bg-indigo-600"
          }`}>
            {mode === "pf" ? "PF" : "PJ"}
          </div>
          <div className={`flex flex-col flex-1 min-w-0 ${open ? "" : "md:hidden"}`}>
            <span className="font-bold text-sm tracking-wide text-white truncate">
              {mode === "pf" ? "Finanças Pessoais" : "Casal do Tráfego"}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium truncate flex items-center gap-1">
              {mode === "pf" ? (
                <>
                  <Baby className="w-3 h-3 text-pink-400 inline" /> Matheus & Sofia
                </>
              ) : (
                "Agência de Tráfego"
              )}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="text-zinc-500 hover:text-zinc-200 flex-shrink-0 md:hidden p-2 -m-2"
          >
            <X size={18} />
          </button>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Recolher menu" : "Expandir menu"}
            className="text-zinc-500 hover:text-zinc-200 flex-shrink-0 hidden md:block"
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Card Seletor de Perfil no Menu Lateral */}
        {open && (
          <div className="p-3 mx-2 my-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Alternar Visualização:</p>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 rounded-lg">
              <button
                onClick={() => handleSwitchMode("pj")}
                className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                  mode === "pj"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Building2 size={12} />
                <span>Empresa</span>
              </button>

              <button
                onClick={() => handleSwitchMode("pf")}
                className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                  mode === "pf"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Home size={12} />
                <span>Pessoal</span>
              </button>
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon, badge }: any) => {
            const active =
              href === "/dashboard"
                ? path === "/dashboard"
                : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? mode === "pf"
                      ? "bg-purple-600/20 text-purple-300 border border-purple-600/40"
                      : "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={16} className={`flex-shrink-0 ${active && mode === "pf" ? "text-purple-400" : ""}`} />
                  <span className={`whitespace-nowrap truncate ${open ? "" : "md:hidden"}`}>{label}</span>
                </div>
                {badge && open && (
                  <span className="text-[10px] bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-1.5 py-0.5 rounded-md">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-zinc-800">
          <div
            className={`flex items-center gap-2 px-2 py-1 ${
              open ? "" : "md:justify-center md:gap-0 md:px-0"
            }`}
          >
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  );
}

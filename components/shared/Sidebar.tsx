"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ClipboardList, FileText, ArrowLeftRight, Bell, Settings, Menu, X } from "lucide-react";
import { UserButton } from "@stackframe/stack";
import { useSidebar } from "@/lib/contexts/SidebarContext";

const nav = [
  { href: "/dashboard",    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/clients",      label: "Clientes",        icon: Users },
  { href: "/contracts",    label: "Contratos",       icon: ClipboardList },
  { href: "/invoices",     label: "Faturas",         icon: FileText },
  { href: "/cash-flow",    label: "Fluxo de Caixa",  icon: ArrowLeftRight },
  { href: "/reminders",    label: "Lembretes",       icon: Bell },
  { href: "/settings",     label: "Configurações",   icon: Settings },
];

export default function Sidebar() {
  // Colapso do desktop, estado local: o drawer mobile vem do contexto.
  const [open, setOpen] = useState(true);
  const path = usePathname();
  const { mobileOpen, closeMobile } = useSidebar();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // matchMedia SOMENTE para decidir inert e aria-hidden. O layout é 100% CSS.
  // Começa em true para que nada fique inerte durante a hidratação.
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  // Rede de segurança: navegação que não vem de clique no link fecha o drawer.
  useEffect(() => {
    closeMobile();
  }, [path, closeMobile]);

  // Esc fecha, listener registrado só enquanto o drawer está aberto.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  // Ao abrir, o foco vai para o botão de fechar do drawer.
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
          open ? "md:w-56" : "md:w-16"
        } bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden`}
      >
        {/* Logo + toggle */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            CT
          </div>
          <span
            className={`font-bold text-sm tracking-wide text-white flex-1 whitespace-nowrap ${
              open ? "" : "md:hidden"
            }`}
          >
            Casal do Tráfego
          </span>
          {/* Fecha o drawer, só no mobile */}
          <button
            ref={closeBtnRef}
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="text-zinc-500 hover:text-zinc-200 flex-shrink-0 md:hidden p-3 -m-3"
          >
            <X size={18} />
          </button>
          {/* Colapsa a barra, só no desktop */}
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Recolher menu" : "Expandir menu"}
            className="text-zinc-500 hover:text-zinc-200 flex-shrink-0 hidden md:block"
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? path === "/dashboard"
                : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {/* No mobile o rótulo aparece sempre. No desktop ele some com o colapso. */}
                <span className={`whitespace-nowrap ${open ? "" : "md:hidden"}`}>{label}</span>
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

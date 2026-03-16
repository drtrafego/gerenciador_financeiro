"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ClipboardList, FileText, ArrowLeftRight, Settings, Menu, X } from "lucide-react";
import { UserButton } from "@stackframe/stack";

const nav = [
  { href: "/dashboard",  label: "Dashboard",     icon: LayoutDashboard },
  { href: "/clients",    label: "Clientes",       icon: Users },
  { href: "/contracts",  label: "Contratos",      icon: ClipboardList },
  { href: "/invoices",   label: "Faturas",        icon: FileText },
  { href: "/cash-flow",  label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { href: "/settings",   label: "Configurações",  icon: Settings },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const path = usePathname();

  return (
    <aside
      className={`${
        open ? "w-56" : "w-16"
      } flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-200`}
    >
      {/* Logo + toggle */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
          DR
        </div>
        {open && (
          <span className="font-bold text-sm tracking-wide text-white flex-1">
            DR.TRÁFEGO
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="text-zinc-500 hover:text-zinc-200 flex-shrink-0"
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {open && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-zinc-800">
        <div className={`flex ${open ? "items-center gap-2 px-2 py-1" : "justify-center"}`}>
          <UserButton />
        </div>
      </div>
    </aside>
  );
}

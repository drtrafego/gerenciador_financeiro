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
  Baby,
  Building2,
  Home,
  Globe,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { UserButton } from "@stackframe/stack";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useProfile } from "@/lib/contexts/ProfileContext";

interface NavSubitem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
}

interface NavSection {
  id: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  items: NavSubitem[];
}

const navSectionsPJ: NavSection[] = [
  {
    id: "operacoes_pj",
    title: "Atendimento & Operações",
    badge: "ADMIN",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30",
    items: [
      { href: "/dashboard", label: "Dashboard Empresa", icon: LayoutDashboard },
      { href: "/reminders", label: "Lembretes WhatsApp", icon: Bell },
    ],
  },
  {
    id: "comercial_pj",
    title: "Comercial & Clientes",
    items: [
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/contracts", label: "Contratos", icon: ClipboardList },
    ],
  },
  {
    id: "financeiro_pj",
    title: "Financeiro & Faturamento",
    items: [
      { href: "/invoices", label: "Faturas", icon: FileText },
      { href: "/cash-flow", label: "Fluxo de Caixa", icon: ArrowLeftRight },
    ],
  },
  {
    id: "config_pj",
    title: "Configurações",
    items: [
      { href: "/settings", label: "Geral", icon: Settings },
      { href: "/settings/exchange-rates", label: "Taxas de Câmbio", icon: Globe },
    ],
  },
];

const navSectionsPF: NavSection[] = [
  {
    id: "visao_pf",
    title: "Visão Geral Pessoal",
    badge: "PESSOAL",
    badgeColor: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    items: [
      { href: "/dashboard", label: "Visão Geral Pessoal", icon: LayoutDashboard },
      { href: "/scan", label: "Escanear Foto/Print", icon: Sparkles, badge: "IA" },
    ],
  },
  {
    id: "gestao_pf",
    title: "Gestão Financeira",
    items: [
      { href: "/credit-cards", label: "Cartões (ARS/BRL)", icon: CreditCard },
      { href: "/personal-categories", label: "Categorias & Metas", icon: PieChart },
    ],
  },
  {
    id: "config_pf",
    title: "Configurações & Família",
    items: [
      { href: "/settings", label: "Configurações & Filhos", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const path = usePathname();
  const router = useRouter();
  const { mobileOpen, closeMobile } = useSidebar();
  const { mode, setMode } = useProfile();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [childrenList, setChildrenList] = useState<string[]>([]);

  // Estado das seções recolhidas/encolhidas
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isPF = mode === "pf" || (typeof window !== "undefined" && (localStorage.getItem("app_profile_mode") === "pf" || document.cookie.includes("app_profile_mode=pf")));
  const sections = isPF ? navSectionsPF : navSectionsPJ;

  const handleSwitchMode = (newMode: "pj" | "pf") => {
    setMode(newMode);
    router.push("/dashboard");
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  useEffect(() => {
    const loadChildren = () => {
      const storedChildren = localStorage.getItem("user_personal_children");
      if (storedChildren) {
        try {
          setChildrenList(JSON.parse(storedChildren));
        } catch (e) {}
      }
    };

    loadChildren();

    window.addEventListener("user_pf_data_changed", loadChildren);
    window.addEventListener("storage", loadChildren);

    return () => {
      window.removeEventListener("user_pf_data_changed", loadChildren);
      window.removeEventListener("storage", loadChildren);
    };
  }, []);

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
          open ? "md:w-64" : "md:w-16"
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
                  <Baby className="w-3 h-3 text-pink-400 inline" /> {childrenList.length > 0 ? childrenList.join(" & ") : "Família"}
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

        {/* Seções Principais & Subpáginas Encolhíveis */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-3 overflow-y-auto">
          {sections.map((sec) => {
            const isCollapsed = collapsedSections[sec.id] === true;
            const hasActiveChild = sec.items.some((item) =>
              item.href === "/dashboard" ? path === "/dashboard" : path.startsWith(item.href)
            );

            return (
              <div key={sec.id} className="space-y-1">
                {/* Cabeçalho da Seção Principal (Com botão de expandir/encolher) */}
                {open ? (
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-200 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate tracking-wider">{sec.title}</span>
                      {sec.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${sec.badgeColor || "bg-zinc-800 text-zinc-300"}`}>
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-500 group-hover:text-zinc-300">
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </div>
                  </button>
                ) : (
                  <div className="h-px bg-zinc-800 my-1" />
                )}

                {/* Subpáginas da Seção (Mostra se não estiver encolhida) */}
                {(!isCollapsed || !open) && (
                  <div className={`space-y-0.5 ${open ? "ml-1 pl-2 border-l border-zinc-800/80" : ""}`}>
                    {sec.items.map(({ href, label, icon: Icon, badge }) => {
                      const active =
                        href === "/dashboard"
                          ? path === "/dashboard"
                          : path.startsWith(href);

                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={closeMobile}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all ${
                            active
                              ? mode === "pf"
                                ? "bg-purple-600/20 text-purple-300 border border-purple-600/40 font-bold shadow-sm"
                                : "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 font-bold shadow-sm"
                              : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon size={15} className={`flex-shrink-0 ${active ? (mode === "pf" ? "text-purple-400" : "text-indigo-400") : "text-zinc-400"}`} />
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
                  </div>
                )}
              </div>
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

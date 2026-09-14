"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { Building2, Home, Globe } from "lucide-react";

export default function ProfileSwitcher() {
  const { mode, setMode, lang, setLang } = useProfile();

  return (
    <div className="flex items-center gap-2">
      {/* Selector de Perfil PJ vs PF */}
      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
        <button
          onClick={() => setMode("pj")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
            mode === "pj"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Building2 size={14} />
          <span>Empresa (PJ)</span>
        </button>

        <button
          onClick={() => setMode("pf")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
            mode === "pf"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Home size={14} />
          <span>Pessoal (PF)</span>
        </button>
      </div>

      {/* Selector Bilíngue (Visível no modo PF) */}
      {mode === "pf" && (
        <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          <Globe size={13} className="text-indigo-400 ml-1.5 mr-0.5" />
          <button
            onClick={() => setLang("pt")}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              lang === "pt" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            PT 🇧🇷
          </button>
          <button
            onClick={() => setLang("es")}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              lang === "es" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            ES 🇦🇷
          </button>
        </div>
      )}
    </div>
  );
}

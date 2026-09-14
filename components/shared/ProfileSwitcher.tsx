"use client";

import React from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { Building2, Home, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfileSwitcher() {
  const { mode, setMode, lang, setLang } = useProfile();
  const router = useRouter();

  const handleSwitchMode = (newMode: "pj" | "pf") => {
    setMode(newMode);
    router.push("/dashboard");
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Selector de Perfil PJ vs PF super responsivo */}
      <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-md">
        <button
          onClick={() => handleSwitchMode("pj")}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all ${
            mode === "pj"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 sm:ring-2 ring-indigo-500/50"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Building2 size={13} className="sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">🏢 EMPRESA (PJ)</span>
          <span className="sm:hidden font-bold">PJ</span>
        </button>

        <button
          onClick={() => handleSwitchMode("pf")}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all ${
            mode === "pf"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30 ring-1 sm:ring-2 ring-purple-500/50 animate-pulse"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Home size={13} className="sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">🏠 PESSOAL (PF)</span>
          <span className="sm:hidden font-bold">PF</span>
        </button>
      </div>

      {/* Selector Bilíngue (Visível no modo PF) */}
      {mode === "pf" && (
        <div className="hidden md:flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1">
          <Globe size={13} className="text-purple-400 ml-1.5 mr-1" />
          <button
            onClick={() => setLang("pt")}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
              lang === "pt" ? "bg-purple-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            PT 🇧🇷
          </button>
          <button
            onClick={() => setLang("es")}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
              lang === "es" ? "bg-purple-600 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            ES 🇦🇷
          </button>
        </div>
      )}
    </div>
  );
}

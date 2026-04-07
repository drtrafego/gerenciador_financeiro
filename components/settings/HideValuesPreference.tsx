"use client";

import { Eye, EyeOff } from "lucide-react";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

export default function HideValuesPreference() {
  const { hidden, toggle } = useValuesVisibility();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">Ocultar valores monetários</p>
          <p className="text-xs text-zinc-500 mt-1">
            Esconde todos os valores financeiros em todas as páginas. Útil ao compartilhar a tela.
          </p>
        </div>
        <button
          onClick={toggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            hidden
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20"
              : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
          }`}
        >
          {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          {hidden ? "Oculto" : "Visível"}
        </button>
      </div>
      {hidden && (
        <p className="mt-3 text-xs text-indigo-400/80 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2">
          Valores estão ocultos em todas as páginas. Clique em "Oculto" para mostrar novamente.
        </p>
      )}
    </div>
  );
}

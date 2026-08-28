"use client";

import { useRouter, usePathname } from "next/navigation";
import { Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

// Barra de período das telas financeiras: navegação mês a mês, seletor de
// intervalo e o botão de esconder valores.
//
// Nasceu dentro do fluxo de caixa e foi extraída para o dashboard usar a MESMA
// barra, não uma cópia parecida. O caminho vem do usePathname, então ela navega
// na tela onde está montada, sem rota fixa.

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Props = {
  from: string;
  to: string;
  /** Conteúdo alinhado à direita, por exemplo o botão de novo lançamento. */
  children?: React.ReactNode;
};

export default function PeriodBar({ from, to, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { hidden: valuesHidden, toggle: toggleValues } = useValuesVisibility();

  const fromD = new Date(from + "T12:00:00");

  // Mover de mês sempre cai no mês inteiro, que é o que faz o rótulo "Agosto
  // 2026" bater com o intervalo mostrado ao lado.
  const goMonth = (delta: number) => {
    const d = new Date(fromD.getFullYear(), fromD.getMonth() + delta, 1);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    router.push(`${pathname}?from=${iso(inicio)}&to=${iso(fim)}`);
  };

  // No mobile os controles de período ficam agrupados em cima e o children ganha
  // a linha de baixo inteira. A partir de sm tudo volta para a mesma linha, com o
  // children empurrado para a direita.
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {/* 40x40 no celular, 32x32 a partir de sm, que é o tamanho de hoje e o
              ponto em que a barra volta a ser uma linha só. Sem o sm as setas
              engordariam a barra no computador. */}
          <button
            onClick={() => goMonth(-1)}
            className="text-zinc-400 hover:text-zinc-200 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-200 min-w-[120px] text-center">
            {MONTHS[fromD.getMonth()]} {fromD.getFullYear()}
          </span>
          <button
            onClick={() => goMonth(1)}
            className="text-zinc-400 hover:text-zinc-200 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <DateRangePicker from={from} to={to} />

        {/* No celular o rótulo some e sobra o ícone de 14px, o que dava um alvo de
            38x30. O h-10 mais o min-w-10 levam a 40x40. A partir de sm o h-auto e
            o min-w-0 devolvem os 36px de altura e a largura do rótulo. */}
        <button
          onClick={toggleValues}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 h-10 min-w-10 sm:h-auto sm:min-w-0 rounded-lg text-sm transition-colors ${
            valuesHidden
              ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
          title={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
        >
          {valuesHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">{valuesHidden ? "Mostrar" : "Ocultar"}</span>
        </button>
      </div>

      {children && <div className="sm:ml-auto">{children}</div>}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { formatCurrency, convertAmount, asCurrency } from "@/lib/currency/format";
import type { Currency, RatesMap } from "@/lib/currency/format";
import { effectiveContractStatus } from "@/lib/contracts";
import { todayBrt } from "@/lib/period";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import ContractsTable from "./ContractsTable";
import TransactionModal from "@/components/cashflow/TransactionModal";

type TxRow = {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: string | null;
  baseAmount?: string | null;
  iof?: boolean | null;
  currency: string | null;
  date: string;
  clientId?: string | null;
  isRecurring: string | null;
  recurringActive: string | null;
  recurringEndsAt: string | null;
};

interface Props {
  contractRows: any[];
  projects: { t: TxRow; clientName: string | null }[];
  recurring: { t: TxRow; clientName: string | null }[];
  clients: { id: string; name: string }[];
  displayCurrency: Currency;
  rate: RatesMap;
  /** Quantas linhas de receita mostrar por bloco. A consulta traz uma a mais. */
  limite: number;
}

const HIDDEN = "••••••";

export default function ContractsView({
  contractRows,
  projects,
  recurring,
  clients,
  displayCurrency,
  rate,
  limite,
}: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const { hidden } = useValuesVisibility();

  // Valor convertido para a moeda de exibição, igual ao dashboard e ao fluxo de
  // caixa. Antes cada linha aparecia na sua própria moeda nativa, sem tradução
  // para a moeda escolhida em Configurações, então a tela misturava real com
  // dólar e nada podia ser comparado de cabeça.
  const fmt = (amount: string | null, currency: string | null) =>
    hidden
      ? HIDDEN
      : formatCurrency(
          convertAmount(parseFloat(amount ?? "0"), asCurrency(currency), displayCurrency, rate),
          displayCurrency
        );

  // Moeda original ao lado, quando é diferente da de exibição.
  const fmtOriginal = (amount: string | null, currency: string | null) =>
    hidden ? null : formatCurrency(parseFloat(amount ?? "0"), asCurrency(currency));

  // Contrato que forma o MRR: ativo e dentro do prazo. É o mesmo critério do
  // dashboard, para os dois números fecharem.
  const contratosAtivos = contractRows.filter(
    (r) => effectiveContractStatus(r.contract?.status, r.contract?.endDate) === "active"
  ).length;

  // Recorrência viva: não foi parada à mão e ainda não passou do fim. Sem isso o
  // contador somava as encerradas e o rótulo prometia mais receita do que existe.
  // O hoje vem do todayBrt, nunca do UTC, senão o dia vira às 21h no Brasil.
  const hojeIso = todayBrt();
  const recorrenteViva = (t: TxRow) =>
    t.recurringActive !== "false" && (!t.recurringEndsAt || t.recurringEndsAt >= hojeIso);

  // Regra dos rótulos desta tela: o número mostra o que a tabela realmente traz,
  // a tabela nunca é filtrada (contrato encerrado e recorrência parada precisam
  // ficar consultáveis) e o que está vivo vem escrito ao lado. Quando a consulta
  // bate no limite, o rótulo confessa que é um recorte, em vez de dizer "(50)"
  // como se fossem só 50.
  const projetosVisiveis = projects.slice(0, limite);
  const projetosCortados = projects.length > limite;
  const recorrentesVisiveis = recurring.slice(0, limite);
  const recorrentesCortadas = recurring.length > limite;
  const recorrentesAtivas = recorrentesVisiveis.filter((r) => recorrenteViva(r.t)).length;
  const rotuloQuantidade = (visiveis: number, cortou: boolean) =>
    cortou ? `${limite} mais recentes` : String(visiveis);

  return (
    <div className="space-y-8">
      {/* Botões */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Link
          href="/contracts/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Link>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Receita
        </button>
      </div>

      {/* Contratos */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400">
          Contratos ({contractRows.length}), {contratosAtivos} ativo{contratosAtivos === 1 ? "" : "s"}
        </h2>
        {contractRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-center">
            <FileText className="h-9 w-9 text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">Nenhum contrato cadastrado</p>
          </div>
        ) : (
          <ContractsTable rows={contractRows} displayCurrency={displayCurrency} rate={rate} />
        )}
      </div>

      {/* Receitas avulsas */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-400">
            Receitas avulsas ({rotuloQuantidade(projetosVisiveis.length, projetosCortados)})
          </h2>
          <p className="text-xs text-zinc-500">Mentoria, consultoria, comissão e valores únicos ou parcelados. Entram no fluxo de caixa e na ficha do cliente.</p>
        </div>
        {projetosVisiveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-12 text-center">
            <p className="text-zinc-500 text-sm">Nenhuma receita avulsa lançada</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Receita
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Descrição", "Categoria", "Cliente", "Data", "Valor"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {projetosVisiveis.map(({ t, clientName }) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-zinc-200">{t.description}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{t.category}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap">
                      {fmt(t.amount, t.currency)}
                      {!hidden && asCurrency(t.currency) !== displayCurrency && (
                        <span className="block text-xs font-normal text-zinc-600">
                          {fmtOriginal(t.amount, t.currency)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receitas recorrentes: saíram do bloco de avulsas, onde não deveriam
          estar, mas precisam continuar visíveis e editáveis por aqui.

          O bloco inteiro some quando não existe nenhuma recorrente. É decisão
          consciente, não esquecimento: quem nunca lançou receita recorrente não
          precisa aprender que ela existe por uma tabela vazia, e o caminho de
          criar é o mesmo botão "Nova Receita" lá em cima. */}
      {recurring.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-400">
              Receitas recorrentes ({rotuloQuantidade(recorrentesVisiveis.length, recorrentesCortadas)}),{" "}
              {recorrentesAtivas} ativa{recorrentesAtivas === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-zinc-500">Entradas que se repetem todo mês e não vêm de contrato. São projetadas no fluxo de caixa.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Descrição", "Categoria", "Cliente", "Início", "Situação", "Valor"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {recorrentesVisiveis.map(({ t, clientName }) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-zinc-200">{t.description}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{t.category}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {!recorrenteViva(t) ? (
                        <span className="text-zinc-500">encerrada</span>
                      ) : t.recurringEndsAt ? (
                        <span className="text-zinc-400">
                          até {new Date(t.recurringEndsAt + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-green-400/80">ativa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap">
                      {fmt(t.amount, t.currency)}
                      {!hidden && asCurrency(t.currency) !== displayCurrency && (
                        <span className="block text-xs font-normal text-zinc-600">
                          {fmtOriginal(t.amount, t.currency)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <TransactionModal
          onClose={() => {
            setShowNew(false);
            router.refresh();
          }}
          clients={clients}
          defaultType="income"
        />
      )}
      {editing && (
        <TransactionModal
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
          transaction={editing}
          clients={clients}
        />
      )}
    </div>
  );
}

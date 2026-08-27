export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { getExchangeRateHistory } from '@/lib/db/queries';
import Link from 'next/link';

async function ExchangeRatesContent() {
  const history = await getExchangeRateHistory(30);

  // Formatação única para os dois blocos, o de card e o de tabela, para as casas
  // decimais, o formato de data e o fuso nunca divergirem entre mobile e desktop
  const fmtRates = (r: (typeof history)[number]) => ({
    fetchedAt: r.fetchedAt
      ? new Date(r.fetchedAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
      : '—',
    usdBrl: `R$ ${parseFloat(r.usdBrl).toFixed(4)}`,
    usdArs: `$ ${parseFloat(r.usdArs).toFixed(2)}`,
    arsBrl: parseFloat(r.arsBrl).toFixed(6),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-sm text-zinc-400 hover:text-white">
          ← Configurações
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold text-white">Histórico de Cotações</h1>
        <p className="text-sm text-zinc-400">Últimas 30 dias de atualizações</p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-16 text-center">
          <p className="text-zinc-400">Nenhuma cotação registrada ainda</p>
          <p className="text-sm text-zinc-500 mt-1">
            Vá em Configurações e clique em "Atualizar Agora"
          </p>
        </div>
      ) : (
        <>
        {/* Cards no mobile, os valores em coluna para não comprimir as casas decimais */}
        <div className="flex flex-col gap-2 sm:hidden">
          {history.map((r) => {
            const v = fmtRates(r);
            return (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-zinc-300">{v.fetchedAt}</p>
                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {r.source ?? '—'}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-zinc-500">USD→BRL</span>
                  <span className="font-mono text-sm text-white">{v.usdBrl}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-zinc-500">USD→ARS</span>
                  <span className="font-mono text-sm text-white">{v.usdArs}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-zinc-500">ARS→BRL</span>
                  <span className="font-mono text-sm text-white">{v.arsBrl}</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        <div className="hidden sm:block rounded-xl border border-zinc-800 bg-zinc-900 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400">Data</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">USD→BRL</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">USD→ARS</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">ARS→BRL</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {history.map((r) => {
                const v = fmtRates(r);
                return (
                <tr key={r.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3 text-zinc-300">{v.fetchedAt}</td>
                  <td className="px-5 py-3 text-right font-mono text-white">{v.usdBrl}</td>
                  <td className="px-5 py-3 text-right font-mono text-white">{v.usdArs}</td>
                  <td className="px-5 py-3 text-right font-mono text-white">{v.arsBrl}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {r.source ?? '—'}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

export default function ExchangeRatesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 max-w-3xl">
          <div className="h-8 w-56 animate-pulse rounded bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
        </div>
      }
    >
      <ExchangeRatesContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { getExchangeRateHistory } from '@/lib/db/queries';
import Link from 'next/link';

async function ExchangeRatesContent() {
  const history = await getExchangeRateHistory(30);

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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
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
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3 text-zinc-300">
                    {r.fetchedAt
                      ? new Date(r.fetchedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Sao_Paulo',
                        })
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">
                    R$ {parseFloat(r.usdBrl).toFixed(4)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">
                    $ {parseFloat(r.usdArs).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">
                    {parseFloat(r.arsBrl).toFixed(6)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {r.source ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

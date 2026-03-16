'use client';

import { useState } from 'react';
import { RefreshCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Rate {
  usdBrl: string;
  usdArs: string;
  arsBrl: string;
  fetchedAt: Date | null;
  source: string | null;
}

interface ExchangeRateWidgetProps {
  rate: Rate | null;
  cronSecret: string;
}

export function ExchangeRateWidget({ rate, cronSecret }: ExchangeRateWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleUpdate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cron/update-rates', {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Cotação atualizada via ${data.rates?.source ?? 'API'}` });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult({ success: false, message: 'Erro ao atualizar cotação' });
      }
    } catch {
      setResult({ success: false, message: 'Falha na requisição' });
    }
    setLoading(false);
  }

  const ageMin = rate?.fetchedAt
    ? Math.round((Date.now() - new Date(rate.fetchedAt).getTime()) / 60000)
    : null;

  const fmtBrl = (v: string) =>
    parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtArs = (v: string) =>
    parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Cotações do Dia</h3>
          {ageMin !== null && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Última atualização há {ageMin} min
              {rate?.source && <> · via {rate.source}</>}
            </p>
          )}
        </div>
        <button
          onClick={handleUpdate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar Agora'}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            result.success
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {result.message}
        </div>
      )}

      {rate ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">USD → BRL</p>
            <p className="text-base font-bold text-white">{fmtBrl(rate.usdBrl)}</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">USD → ARS</p>
            <p className="text-base font-bold text-white">$ {fmtArs(rate.usdArs)}</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">ARS → BRL</p>
            <p className="text-base font-bold text-white">{parseFloat(rate.arsBrl).toFixed(4)}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-zinc-800 p-4 text-center">
          <p className="text-sm text-zinc-400">Nenhuma cotação registrada</p>
          <p className="text-xs text-zinc-500 mt-1">
            Clique em "Atualizar Agora" para buscar a cotação atual
          </p>
        </div>
      )}
    </div>
  );
}

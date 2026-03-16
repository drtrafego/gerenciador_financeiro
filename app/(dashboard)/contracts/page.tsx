export const dynamic = "force-dynamic";

import Link from 'next/link';
import { getContracts } from '@/lib/db/queries';
import { Plus, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { cn } from '@/lib/utils';

const typeLabels: Record<string, string> = {
  fixed_fee: 'Fee Fixo',
  fixed_plus_percentage: 'Fixo + %',
  project: 'Projeto',
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};
const statusLabels: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

export default async function ContractsPage() {
  const rows = await getContracts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contratos</h1>
          <p className="text-sm text-zinc-400">{rows.length} contrato(s) cadastrado(s)</p>
        </div>
        <Link
          href="/contracts/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
          <FileText className="h-10 w-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium">Nenhum contrato cadastrado</p>
          <Link
            href="/contracts/new"
            className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Valor Fixo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Venc.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map(({ contract, clientName }) => (
                <tr key={contract.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{clientName ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {typeLabels[contract.type] ?? contract.type}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {formatCurrency(parseFloat(contract.fixedAmount ?? '0'), (contract.currency as Currency) ?? 'BRL')}
                    {contract.type === 'fixed_plus_percentage' && contract.percentage && (
                      <span className="ml-1 text-zinc-500">+ {contract.percentage}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">Dia {contract.billingDay}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        statusStyles[contract.status ?? 'active']
                      )}
                    >
                      {statusLabels[contract.status ?? 'active']}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Ver →
                    </Link>
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

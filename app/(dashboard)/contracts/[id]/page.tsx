export const dynamic = "force-dynamic";

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getContractById, getClients } from '@/lib/db/queries';
import { deleteContractAction, updateContractAction } from '../actions';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { cn } from '@/lib/utils';
import { Trash2, FileText } from 'lucide-react';

const typeLabels: Record<string, string> = {
  fixed_fee: 'Fee Fixo',
  fixed_plus_percentage: 'Fixo + % sobre verba',
  project: 'Projeto',
};

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, clients] = await Promise.all([getContractById(id), getClients()]);
  if (!contract) notFound();

  const deleteWithId = deleteContractAction.bind(null, id);
  const updateWithId = updateContractAction.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Contrato — {typeLabels[contract.type] ?? contract.type}
          </h1>
          <p className="text-sm text-zinc-400">
            {formatCurrency(parseFloat(contract.fixedAmount ?? '0'), (contract.currency as Currency) ?? 'BRL')}
            {contract.type === 'fixed_plus_percentage' && contract.percentage && (
              <> + {contract.percentage}% sobre verba</>
            )}
          </p>
        </div>
        <form action={deleteWithId}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </form>
      </div>

      <form action={updateWithId} className="space-y-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Cliente *</label>
              <select
                name="clientId"
                required
                defaultValue={contract.clientId ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
              <select
                name="type"
                defaultValue={contract.type}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="fixed_fee">Fee Fixo</option>
                <option value="fixed_plus_percentage">Fixo + %</option>
                <option value="project">Projeto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Moeda</label>
              <select
                name="currency"
                defaultValue={contract.currency ?? 'BRL'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Valor Fixo *</label>
              <input
                name="fixedAmount"
                required
                defaultValue={contract.fixedAmount ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">% sobre verba</label>
              <input
                name="percentage"
                defaultValue={contract.percentage ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Verba gerenciada</label>
              <input
                name="adBudget"
                defaultValue={contract.adBudget ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Dia de cobrança</label>
              <input
                name="billingDay"
                type="number"
                min="1"
                max="31"
                defaultValue={String(contract.billingDay ?? 5)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Status</label>
              <select
                name="status"
                defaultValue={contract.status ?? 'active'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Data início</label>
              <input
                name="startDate"
                type="date"
                required
                defaultValue={contract.startDate}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Data término</label>
              <input
                name="endDate"
                type="date"
                defaultValue={contract.endDate ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Descrição</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={contract.description ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">
                Link do Contrato em PDF
                <span className="text-zinc-600 font-normal ml-1">(Google Drive, Dropbox, etc.)</span>
              </label>
              <input
                name="pdfUrl"
                type="url"
                defaultValue={contract.pdfUrl ?? ''}
                placeholder="https://drive.google.com/..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {contract.pdfUrl && (
                <a
                  href={contract.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Abrir PDF do contrato
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Salvar Alterações
          </button>
          <Link
            href="/contracts"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Voltar
          </Link>
        </div>
      </form>
    </div>
  );
}

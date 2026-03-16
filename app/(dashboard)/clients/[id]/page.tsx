import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClientWithDetails } from '@/lib/db/queries';
import { deleteClientAction, updateClientAction } from '../actions';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { cn } from '@/lib/utils';
import { Mail, Phone, Pencil, Trash2, FileText, Plus } from 'lucide-react';

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  inactive: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
};
const statusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  overdue: 'Inadimplente',
};
const invoiceStatusStyles: Record<string, string> = {
  draft: 'text-zinc-400',
  sent: 'text-blue-400',
  paid: 'text-green-400',
  overdue: 'text-red-400',
  cancelled: 'text-zinc-600',
};
const invoiceStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientWithDetails(id);
  if (!data) notFound();

  const deleteWithId = deleteClientAction.bind(null, id);
  const updateWithId = updateClientAction.bind(null, id);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 font-bold">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{data.name}</h1>
            {data.contactName && (
              <p className="text-sm text-zinc-400">{data.contactName}</p>
            )}
          </div>
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
              statusStyles[data.status ?? 'active']
            )}
          >
            {statusLabels[data.status ?? 'active']}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <form action={deleteWithId}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={(e) => {
                if (!confirm('Excluir este cliente?')) e.preventDefault();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </form>
        </div>
      </div>

      {/* Info + Edição */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Informações</h2>
          {data.email && (
            <div className="flex items-center gap-2 text-sm text-white">
              <Mail className="h-4 w-4 text-zinc-500" />
              {data.email}
            </div>
          )}
          {data.phone && (
            <div className="flex items-center gap-2 text-sm text-white">
              <Phone className="h-4 w-4 text-zinc-500" />
              {data.phone}
            </div>
          )}
          <div className="text-sm text-zinc-400">
            Moeda: <span className="text-white">{data.currency ?? 'BRL'}</span>
          </div>
          {data.notes && (
            <div className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
              {data.notes}
            </div>
          )}
        </div>

        {/* Editar */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Editar Cliente</h2>
          <form action={updateWithId} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Nome *</label>
                <input
                  name="name"
                  required
                  defaultValue={data.name}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Contato</label>
                <input
                  name="contactName"
                  defaultValue={data.contactName ?? ''}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={data.email ?? ''}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Telefone</label>
                <input
                  name="phone"
                  defaultValue={data.phone ?? ''}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Moeda</label>
                <select
                  name="currency"
                  defaultValue={data.currency ?? 'BRL'}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={data.status ?? 'active'}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="overdue">Inadimplente</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Observações</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={data.notes ?? ''}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              Salvar Alterações
            </button>
          </form>
        </div>
      </div>

      {/* Contratos */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">
            Contratos ({data.contracts.length})
          </h2>
          <Link
            href={`/contracts/new?clientId=${id}`}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Novo contrato
          </Link>
        </div>
        {data.contracts.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum contrato vinculado</p>
        ) : (
          <div className="space-y-2">
            {data.contracts.map((c) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="flex items-center justify-between rounded-lg p-3 hover:bg-zinc-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white capitalize">
                    {c.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Desde {new Date(c.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {formatCurrency(parseFloat(c.fixedAmount ?? '0'), (c.currency as Currency) ?? 'BRL')}
                  </p>
                  <p className={cn('text-xs', c.status === 'active' ? 'text-green-400' : 'text-yellow-400')}>
                    {c.status === 'active' ? 'Ativo' : c.status === 'paused' ? 'Pausado' : 'Cancelado'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Faturas */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">
            Faturas ({data.invoices.length})
          </h2>
          <Link
            href={`/invoices/new?clientId=${id}`}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nova fatura
          </Link>
        </div>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma fatura vinculada</p>
        ) : (
          <div className="space-y-2">
            {data.invoices.slice(0, 5).map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-lg p-3 hover:bg-zinc-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">{inv.invoiceNumber ?? '—'}</p>
                  <p className="text-xs text-zinc-500">
                    Venc. {new Date(inv.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {formatCurrency(parseFloat(inv.amount ?? '0'), (inv.currency as Currency) ?? 'BRL')}
                  </p>
                  <p className={cn('text-xs', invoiceStatusStyles[inv.status ?? 'draft'])}>
                    {invoiceStatusLabels[inv.status ?? 'draft']}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getInvoiceWithClient } from '@/lib/db/queries';
import { deleteInvoiceAction, markInvoicePaidAction } from '../actions';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { cn } from '@/lib/utils';
import { Trash2, CheckCircle, ExternalLink, FileText } from 'lucide-react';

const statusStyles: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-zinc-700/20 text-zinc-600 border-zinc-700/20',
};
const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getInvoiceWithClient(id);
  if (!row) notFound();

  const { invoice, client } = row;
  const markPaidWithId = markInvoicePaidAction.bind(null, id);
  const deleteWithId = deleteInvoiceAction.bind(null, id);
  const isPaid = invoice.status === 'paid';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white font-mono">
              {invoice.invoiceNumber ?? 'FATURA'}
            </h1>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                statusStyles[invoice.status ?? 'draft']
              )}
            >
              {statusLabels[invoice.status ?? 'draft']}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Vencimento:{' '}
            {new Date(invoice.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/invoice/${id}`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Ver pública
          </Link>
          {!isPaid && (
            <form action={markPaidWithId}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Marcar pago
              </button>
            </form>
          )}
          <form action={deleteWithId}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Fatura preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Fatura header */}
        <div className="p-8 border-b border-zinc-800">
          <div className="flex justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white text-lg">DR.TRÁFEGO</span>
              </div>
              <p className="text-xs text-zinc-500">Agência de Tráfego Pago</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 mb-1">FATURA</p>
              <p className="font-mono font-bold text-white text-lg">
                {invoice.invoiceNumber ?? '—'}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                Emitida em{' '}
                {invoice.createdAt
                  ? new Date(invoice.createdAt).toLocaleDateString('pt-BR')
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Client info */}
        <div className="p-8 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Faturado para</p>
          <p className="font-semibold text-white text-lg">{client?.name ?? '—'}</p>
          {client?.email && (
            <p className="text-sm text-zinc-400 mt-1">{client.email}</p>
          )}
          {client?.phone && (
            <p className="text-sm text-zinc-400">{client.phone}</p>
          )}
        </div>

        {/* Items */}
        <div className="p-8 border-b border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left pb-3 text-xs text-zinc-500">Descrição</th>
                <th className="text-right pb-3 text-xs text-zinc-500">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-4 text-white">
                  {invoice.description ?? 'Serviços de gestão de tráfego pago'}
                </td>
                <td className="py-4 text-right font-semibold text-white">
                  {formatCurrency(parseFloat(invoice.amount ?? '0'), (invoice.currency as Currency) ?? 'BRL')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="p-8">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Total</span>
            <span className="text-2xl font-bold text-white">
              {formatCurrency(parseFloat(invoice.amount ?? '0'), (invoice.currency as Currency) ?? 'BRL')}
            </span>
          </div>
          {invoice.notes && (
            <div className="mt-6 rounded-lg bg-zinc-800 p-4">
              <p className="text-xs text-zinc-500 mb-1">Observações (internas)</p>
              <p className="text-sm text-zinc-300">{invoice.notes}</p>
            </div>
          )}
          {isPaid && invoice.paidAt && (
            <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              Pago em {new Date(invoice.paidAt).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/invoices"
          className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          ← Voltar às faturas
        </Link>
      </div>
    </div>
  );
}

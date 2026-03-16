import { notFound } from 'next/navigation';
import { getInvoiceWithClient, getAllSettings } from '@/lib/db/queries';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: 'Rascunho', icon: Clock, color: 'text-zinc-400' },
  sent: { label: 'Aguardando Pagamento', icon: Clock, color: 'text-blue-400' },
  paid: { label: 'Pago', icon: CheckCircle, color: 'text-green-400' },
  overdue: { label: 'Vencido', icon: AlertCircle, color: 'text-red-400' },
  cancelled: { label: 'Cancelado', icon: AlertCircle, color: 'text-zinc-500' },
};

const typeLabels: Record<string, string> = {
  monthly: 'Mensalidade',
  project: 'Projeto',
  proposal: 'Proposta Comercial',
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, settings] = await Promise.all([getInvoiceWithClient(id), getAllSettings()]);
  if (!row) notFound();

  const { invoice, client } = row;
  const status = statusConfig[invoice.status ?? 'draft'] ?? statusConfig.draft;
  const StatusIcon = status.icon;
  const agencyName = settings['agency_name'] ?? 'DR.TRÁFEGO';
  const agencyEmail = settings['agency_email'] ?? '';
  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Status banner */}
        <div className={`mb-6 flex items-center gap-2 text-sm ${status.color}`}>
          <StatusIcon className="h-4 w-4" />
          {status.label}
          {isPaid && invoice.paidAt && (
            <span className="text-zinc-500">
              · em {new Date(invoice.paidAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {/* Fatura card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-8 py-8 border-b border-zinc-800">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-lg font-bold text-white">{agencyName}</span>
                </div>
                {agencyEmail && (
                  <p className="text-xs text-zinc-500 ml-10">{agencyEmail}</p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Fatura</p>
                <p className="font-mono text-xl font-bold text-white">
                  {invoice.invoiceNumber ?? `FAT-${id.slice(0, 8).toUpperCase()}`}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {typeLabels[invoice.type] ?? invoice.type}
                </p>
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="px-8 py-5 border-b border-zinc-800 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Emitida em</p>
              <p className="text-sm font-medium text-white">
                {invoice.createdAt
                  ? new Date(invoice.createdAt).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'America/Sao_Paulo',
                    })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Vencimento</p>
              <p className={`text-sm font-medium ${invoice.status === 'overdue' ? 'text-red-400' : 'text-white'}`}>
                {new Date(invoice.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Para */}
          <div className="px-8 py-5 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Faturado para</p>
            <p className="text-lg font-semibold text-white">{client?.name ?? '—'}</p>
            {client?.email && (
              <p className="text-sm text-zinc-400 mt-1">{client.email}</p>
            )}
            {client?.phone && (
              <p className="text-sm text-zinc-400">{client.phone}</p>
            )}
          </div>

          {/* Serviço */}
          <div className="px-8 py-6 border-b border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left pb-3 text-xs text-zinc-500 font-medium">Descrição</th>
                  <th className="text-right pb-3 text-xs text-zinc-500 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pt-4 pb-2 text-white">
                    {invoice.description ?? 'Serviços de gestão de tráfego pago'}
                  </td>
                  <td className="pt-4 pb-2 text-right font-semibold text-white">
                    {formatCurrency(
                      parseFloat(invoice.amount ?? '0'),
                      (invoice.currency as Currency) ?? 'BRL'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="px-8 py-6">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Total</span>
              <span className="text-3xl font-bold text-white">
                {formatCurrency(
                  parseFloat(invoice.amount ?? '0'),
                  (invoice.currency as Currency) ?? 'BRL'
                )}
              </span>
            </div>

            {isPaid && (
              <div className="mt-6 flex items-center gap-2 justify-center text-green-400 bg-green-500/10 rounded-xl py-3">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Fatura quitada</span>
              </div>
            )}

            {invoice.status === 'overdue' && (
              <div className="mt-6 flex items-center gap-2 justify-center text-red-400 bg-red-500/10 rounded-xl py-3">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Esta fatura está vencida</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          Gerado por {agencyName}
        </p>
      </div>
    </div>
  );
}

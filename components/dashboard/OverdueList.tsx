import Link from 'next/link';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { AlertCircle } from 'lucide-react';

interface OverdueItem {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amount: string;
    currency: string | null;
    dueDate: string;
  };
  clientName: string | null;
}

interface OverdueListProps {
  items: OverdueItem[];
}

export function OverdueList({ items }: OverdueListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Faturas Vencidas</h3>
        <p className="text-sm text-zinc-500">Nenhuma fatura vencida. 🎉</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="h-4 w-4 text-red-400" />
        <h3 className="text-sm font-medium text-zinc-400">Faturas Vencidas</h3>
        <span className="ml-auto rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map(({ invoice, clientName }) => (
          <Link
            key={invoice.id}
            href={`/invoices/${invoice.id}`}
            className="flex items-center justify-between rounded-lg p-3 hover:bg-zinc-800 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-white">{clientName ?? '—'}</p>
              <p className="text-xs text-zinc-500">
                {invoice.invoiceNumber} · venc. {new Date(invoice.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
            <span className="text-sm font-semibold text-red-400">
              {formatCurrency(parseFloat(invoice.amount), (invoice.currency as Currency) ?? 'BRL')}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

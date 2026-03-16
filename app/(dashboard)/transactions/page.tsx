export const dynamic = "force-dynamic";

import Link from 'next/link';
import { getTransactions } from '@/lib/db/queries';
import { deleteTransactionAction } from './actions';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { cn } from '@/lib/utils';

export default async function TransactionsPage() {
  const rows = await getTransactions();

  const totalIncome = rows
    .filter((r) => r.transaction.type === 'income')
    .reduce((s, r) => s + parseFloat(r.transaction.amount ?? '0'), 0);
  const totalExpense = rows
    .filter((r) => r.transaction.type === 'expense')
    .reduce((s, r) => s + parseFloat(r.transaction.amount ?? '0'), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Transações</h1>
          <p className="text-sm text-zinc-400">{rows.length} transação(ões)</p>
        </div>
        <Link
          href="/transactions/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Transação
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Receitas</p>
          <p className="text-lg font-bold text-green-400">
            {formatCurrency(totalIncome, 'BRL')}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Despesas</p>
          <p className="text-lg font-bold text-red-400">
            {formatCurrency(totalExpense, 'BRL')}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 mb-1">Saldo</p>
          <p
            className={cn(
              'text-lg font-bold',
              totalIncome - totalExpense >= 0 ? 'text-white' : 'text-red-400'
            )}
          >
            {formatCurrency(totalIncome - totalExpense, 'BRL')}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
          <ArrowLeftRight className="h-10 w-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium">Nenhuma transação registrada</p>
          <Link
            href="/transactions/new"
            className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Transação
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Cliente</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map(({ transaction, clientName }) => {
                const deleteWithId = deleteTransactionAction.bind(null, transaction.id);
                return (
                  <tr key={transaction.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          transaction.type === 'income'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        )}
                      >
                        {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{transaction.category}</td>
                    <td className="px-4 py-3 text-white">{transaction.description}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{clientName ?? '—'}</td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-semibold',
                        transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {transaction.type === 'expense' ? '−' : '+'}
                      {formatCurrency(
                        parseFloat(transaction.amount ?? '0'),
                        (transaction.currency as Currency) ?? 'BRL'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={deleteWithId}>
                        <button
                          type="submit"
                          className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

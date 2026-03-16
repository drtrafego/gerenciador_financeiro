import { getClients, getContracts } from '@/lib/db/queries';
import { createInvoiceAction } from '../actions';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; contractId?: string }>;
}) {
  const { clientId, contractId } = await searchParams;
  const [clients, contractRows] = await Promise.all([getClients(), getContracts()]);

  // Data de vencimento padrão = próximo dia 5
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const defaultDue = nextMonth.toISOString().split('T')[0];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Nova Fatura</h1>
        <p className="text-sm text-zinc-400">O número será gerado automaticamente</p>
      </div>

      <form action={createInvoiceAction} className="space-y-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Cliente *</label>
              <select
                name="clientId"
                required
                defaultValue={clientId ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione um cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Contrato vinculado (opcional)
              </label>
              <select
                name="contractId"
                defaultValue={contractId ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sem contrato vinculado</option>
                {contractRows.map(({ contract, clientName }) => (
                  <option key={contract.id} value={contract.id}>
                    {clientName} — {contract.type.replace(/_/g, ' ')} ({contract.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo *</label>
              <select
                name="type"
                required
                defaultValue="monthly"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="monthly">Mensal</option>
                <option value="project">Projeto</option>
                <option value="proposal">Proposta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
              <select
                name="status"
                defaultValue="draft"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="draft">Rascunho</option>
                <option value="sent">Enviado</option>
                <option value="paid">Pago</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Valor *</label>
              <input
                name="amount"
                required
                placeholder="0,00"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Moeda</label>
              <select
                name="currency"
                defaultValue="BRL"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BRL">BRL — Real</option>
                <option value="USD">USD — Dólar</option>
                <option value="ARS">ARS — Peso</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Data de vencimento *
              </label>
              <input
                name="dueDate"
                type="date"
                required
                defaultValue={defaultDue}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição</label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Gestão de tráfego — Meta Ads — Mês de Janeiro/2026"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Observações internas
              </label>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Notas internas (não aparecem na fatura pública)"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Criar Fatura
          </button>
          <a
            href="/invoices"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}

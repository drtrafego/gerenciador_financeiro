import { getClients } from '@/lib/db/queries';
import { createTransactionAction } from '../actions';

const INCOME_CATEGORIES = [
  'Mensalidade de cliente',
  'Fee de gestão',
  'Projeto pontual',
  'Bônus / comissão',
  'Outros receitas',
];
const EXPENSE_CATEGORIES = [
  'Ferramentas e softwares',
  'Imposto / DAS',
  'Salário / pró-labore',
  'Marketing',
  'Freelancers',
  'Infraestrutura',
  'Outros despesas',
];

export default async function NewTransactionPage() {
  const clients = await getClients();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Nova Transação</h1>
        <p className="text-sm text-zinc-400">Registre uma receita ou despesa</p>
      </div>

      <form action={createTransactionAction} className="space-y-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo *</label>
              <select
                name="type"
                required
                defaultValue="income"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Categoria *</label>
              <input
                name="category"
                required
                list="categories-list"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Mensalidade de cliente"
              />
              <datalist id="categories-list">
                {[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Descrição *
              </label>
              <input
                name="description"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Pagamento ref. Jan/2026 — Empresa XYZ"
              />
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
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Data *</label>
              <input
                name="date"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Cliente (opcional)
              </label>
              <select
                name="clientId"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sem cliente vinculado</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Registrar Transação
          </button>
          <a
            href="/transactions"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}

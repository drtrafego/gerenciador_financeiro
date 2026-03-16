import { getClients } from '@/lib/db/queries';
import { createContractAction } from '../actions';

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await getClients();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Novo Contrato</h1>
        <p className="text-sm text-zinc-400">Defina os termos do contrato</p>
      </div>

      <form action={createContractAction} className="space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo de Contrato *</label>
              <select
                name="type"
                required
                defaultValue="fixed_fee"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="fixed_fee">Fee Fixo</option>
                <option value="fixed_plus_percentage">Fixo + % sobre verba</option>
                <option value="project">Projeto</option>
              </select>
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

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Valor Fixo *</label>
              <input
                name="fixedAmount"
                required
                placeholder="0,00"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                % sobre verba (opcional)
              </label>
              <input
                name="percentage"
                placeholder="Ex: 10 (= 10%)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Verba gerenciada (opcional)
              </label>
              <input
                name="adBudget"
                placeholder="0,00"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Dia de cobrança</label>
              <input
                name="billingDay"
                type="number"
                defaultValue="5"
                min="1"
                max="31"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Data de início *</label>
              <input
                name="startDate"
                type="date"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Data de término (opcional)
              </label>
              <input
                name="endDate"
                type="date"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
              <select
                name="status"
                defaultValue="active"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição</label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Escopo do contrato, observações..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Link do Contrato em PDF
                <span className="text-zinc-500 font-normal ml-1">(Google Drive, Dropbox, etc.)</span>
              </label>
              <input
                name="pdfUrl"
                type="url"
                placeholder="https://drive.google.com/..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Salvar Contrato
          </button>
          <a
            href="/contracts"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}

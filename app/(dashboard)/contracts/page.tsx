export const dynamic = "force-dynamic";

import Link from 'next/link';
import { getContracts } from '@/lib/db/queries';
import { Plus, FileText } from 'lucide-react';
import ContractsTable from '@/components/contracts/ContractsTable';

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
        <ContractsTable rows={rows} />
      )}
    </div>
  );
}

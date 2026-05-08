import { getClients, getContracts } from '@/lib/db/queries';
import NewInvoiceForm from '@/components/invoices/NewInvoiceForm';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; contractId?: string }>;
}) {
  const { clientId, contractId } = await searchParams;
  const [clients, contractRows] = await Promise.all([getClients(), getContracts()]);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const defaultDue = nextMonth.toISOString().split('T')[0]!;

  const contracts = contractRows.map(({ contract, clientName }) => ({
    id: contract.id,
    name: contract.name ?? null,
    type: contract.type,
    fixedAmount: contract.fixedAmount,
    currency: contract.currency ?? 'BRL',
    clientId: contract.clientId ?? null,
    clientName: clientName ?? null,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Nova Fatura</h1>
        <p className="text-sm text-zinc-400">O número será gerado automaticamente</p>
      </div>
      <NewInvoiceForm
        clients={clients}
        contracts={contracts}
        defaultClientId={clientId}
        defaultContractId={contractId}
        defaultDue={defaultDue}
      />
    </div>
  );
}

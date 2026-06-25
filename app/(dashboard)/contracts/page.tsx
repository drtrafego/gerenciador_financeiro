export const dynamic = "force-dynamic";

import { getContracts } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { transactions, clients } from '@/lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import ContractsView from '@/components/contracts/ContractsView';

export default async function ContractsPage() {
  const [contractRows, projects, clientList] = await Promise.all([
    getContracts(),
    db
      .select({ t: transactions, clientName: clients.name })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(eq(transactions.type, 'income'))
      .orderBy(desc(transactions.date)),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Contratos e Receitas</h1>
        <p className="text-sm text-zinc-400">Honorários recorrentes e receitas avulsas</p>
      </div>
      <ContractsView contractRows={contractRows} projects={projects} clients={clientList} />
    </div>
  );
}

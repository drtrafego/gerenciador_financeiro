export const dynamic = "force-dynamic";

import {
  getContracts,
  getStandaloneIncome,
  getRecurringIncome,
  getDisplaySettings,
} from '@/lib/db/queries';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import ContractsView from '@/components/contracts/ContractsView';

// Quantas linhas de receita a tela mostra em cada bloco. Fica aqui, e não dentro
// do componente, porque é a consulta que precisa saber do limite.
const LIMITE_LISTA = 50;

export default async function ContractsPage() {
  // "Receitas avulsas" listava toda entrada, inclusive de cliente de teste e as
  // recorrentes, que não são avulsas. Agora são duas listas separadas, as duas
  // sem cliente de teste, como no resto do sistema.
  //
  // As duas listas pedem 51 para mostrar 50: a linha extra é o sinal de que o
  // limite estourou, e aí o rótulo diz "50 mais recentes" em vez de mentir um
  // total que não é o total.
  const [contractRows, projects, recurring, clientList, display] = await Promise.all([
    getContracts(),
    getStandaloneIncome(LIMITE_LISTA + 1),
    getRecurringIncome(LIMITE_LISTA + 1),
    // O dropdown de cliente do modal continua SEM filtro de cliente de teste, de
    // propósito: é o mesmo controle do fluxo de caixa e ter duas regras para o
    // mesmo select confunde mais do que resolve.
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    getDisplaySettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Contratos e Receitas</h1>
        <p className="text-sm text-zinc-400">Honorários recorrentes e receitas avulsas</p>
      </div>
      <ContractsView
        contractRows={contractRows}
        projects={projects}
        recurring={recurring}
        clients={clientList}
        displayCurrency={display.displayCurrency}
        rate={display.rate}
        limite={LIMITE_LISTA}
      />
    </div>
  );
}

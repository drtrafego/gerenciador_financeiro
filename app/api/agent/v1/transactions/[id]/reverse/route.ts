import { withAgentAuth } from '@/lib/agent/route';
import { reverseTransactionService } from '@/lib/agent/services/transactions';

// Corrige um lançamento errado sem apagar a linha original: cria um NOVO
// lançamento de sinal oposto ao original, referenciando-o.
export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { original, reversal } = await reverseTransactionService(params.id);
  return {
    status: 201,
    body: reversal,
    resourceType: 'transaction',
    resourceId: reversal.id,
    beforeData: original,
    afterData: reversal,
  };
});

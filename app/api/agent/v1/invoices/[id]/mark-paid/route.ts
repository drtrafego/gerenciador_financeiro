import { withAgentAuth } from '@/lib/agent/route';
import { markInvoicePaidService } from '@/lib/agent/services/invoices';

// Replica a regra do painel: nunca cria transaction, fatura não entra no fluxo de caixa.
export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before, after } = await markInvoicePaidService(params.id);
  return {
    status: 200,
    body: after,
    resourceType: 'invoice',
    resourceId: params.id,
    beforeData: before,
    afterData: after,
  };
});

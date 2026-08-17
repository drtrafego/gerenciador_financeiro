import { withAgentAuth } from '@/lib/agent/route';
import { unconfirmPaymentService } from '@/lib/agent/services/billing';

// Desfaz a confirmação de pagamento. Exige contractId e dueDate: não resolve por
// telefone de propósito, é operação de correção. Idempotente.
export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { removed, contractId, dueDate } = await unconfirmPaymentService(input);

  return {
    status: 200,
    body: { removed, contractId, dueDate },
    resourceType: 'payment_confirmation',
    resourceId: `${contractId}:${dueDate}`,
    requestBody: input,
    beforeData: removed ? { contractId, dueDate, confirmed: true } : null,
    afterData: { contractId, dueDate, confirmed: false },
  };
});

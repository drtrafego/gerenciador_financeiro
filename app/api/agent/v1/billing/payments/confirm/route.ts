import { withAgentAuth } from '@/lib/agent/route';
import { confirmPaymentService } from '@/lib/agent/services/billing';

// Confirma o pagamento de um vencimento. Idempotente e sem efeito financeiro:
// NÃO cria transaction, NÃO mexe em fatura, só interrompe as cobranças
// automáticas de atraso daquele vencimento.
export const POST = withAgentAuth(async ({ request, actor }) => {
  const input = await request.json();
  const { confirmation, alreadyConfirmed, dunningCancelled, contractId, dueDate } =
    await confirmPaymentService(input, actor);

  return {
    status: 200,
    body: { confirmation, alreadyConfirmed, dunningCancelled },
    resourceType: 'payment_confirmation',
    resourceId: `${contractId}:${dueDate}`,
    requestBody: input,
    beforeData: alreadyConfirmed ? confirmation : null,
    afterData: confirmation,
  };
});

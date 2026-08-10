import { withAgentAuth } from '@/lib/agent/route';
import { getTransactionDetail, updateTransactionService } from '@/lib/agent/services/transactions';

export const GET = withAgentAuth<{ id: string }>(async ({ params }) => {
  const transaction = await getTransactionDetail(params.id);
  return { status: 200, body: transaction, resourceType: 'transaction', resourceId: params.id };
});

export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const input = await request.json();
  const { before, after, parsed } = await updateTransactionService(params.id, input);
  return {
    status: 200,
    body: after,
    resourceType: 'transaction',
    resourceId: params.id,
    requestBody: parsed,
    beforeData: before,
    afterData: after,
  };
});

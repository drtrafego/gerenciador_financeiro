import { withAgentAuth } from '@/lib/agent/route';
import { deactivateRecurringService } from '@/lib/agent/services/transactions';

export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before, after } = await deactivateRecurringService(params.id);
  return {
    status: 200,
    body: after,
    resourceType: 'transaction',
    resourceId: params.id,
    beforeData: before,
    afterData: after,
  };
});

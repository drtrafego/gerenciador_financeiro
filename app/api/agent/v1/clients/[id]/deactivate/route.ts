import { withAgentAuth } from '@/lib/agent/route';
import { deactivateClientService } from '@/lib/agent/services/clients';

export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before, after } = await deactivateClientService(params.id);
  return {
    status: 200,
    body: after,
    resourceType: 'client',
    resourceId: params.id,
    beforeData: before,
    afterData: after,
  };
});

import { withAgentAuth } from '@/lib/agent/route';
import { getClientDetail, updateClientService } from '@/lib/agent/services/clients';

export const GET = withAgentAuth<{ id: string }>(async ({ params }) => {
  const client = await getClientDetail(params.id);
  return { status: 200, body: client, resourceType: 'client', resourceId: params.id };
});

export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const input = await request.json();
  const { before, after, parsed } = await updateClientService(params.id, input);
  return {
    status: 200,
    body: after,
    resourceType: 'client',
    resourceId: params.id,
    requestBody: parsed,
    beforeData: before,
    afterData: after,
  };
});

import { withAgentAuth } from '@/lib/agent/route';
import { getContractDetail, updateContractService } from '@/lib/agent/services/contracts';

export const GET = withAgentAuth<{ id: string }>(async ({ params }) => {
  const contract = await getContractDetail(params.id);
  return { status: 200, body: contract, resourceType: 'contract', resourceId: params.id };
});

export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const input = await request.json();
  const { before, after, parsed } = await updateContractService(params.id, input);
  return {
    status: 200,
    body: after,
    resourceType: 'contract',
    resourceId: params.id,
    requestBody: parsed,
    beforeData: before,
    afterData: after,
  };
});

import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { listContracts, createContractService } from '@/lib/agent/services/contracts';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const { data, count } = await listContracts({ limit, offset });
  return { status: 200, body: { data, count }, resourceType: 'contract' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { contract, parsed } = await createContractService(input);
  return {
    status: 201,
    body: contract,
    resourceType: 'contract',
    resourceId: contract.id,
    requestBody: parsed,
    afterData: contract,
  };
});

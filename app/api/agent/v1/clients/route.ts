import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { listClients, createClientService } from '@/lib/agent/services/clients';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const { data, count } = await listClients({ limit, offset });
  return { status: 200, body: { data, count }, resourceType: 'client' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { client, parsed } = await createClientService(input);
  return {
    status: 201,
    body: client,
    resourceType: 'client',
    resourceId: client.id,
    requestBody: parsed,
    afterData: client,
  };
});

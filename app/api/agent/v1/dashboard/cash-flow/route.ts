import { withAgentAuth } from '@/lib/agent/route';
import { getCashFlowService } from '@/lib/agent/services/reports';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const data = await getCashFlowService(from, to);
  return { status: 200, body: data, resourceType: 'dashboard' };
});

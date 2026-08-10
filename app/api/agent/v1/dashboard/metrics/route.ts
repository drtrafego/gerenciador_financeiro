import { withAgentAuth } from '@/lib/agent/route';
import { getDashboardMetricsService } from '@/lib/agent/services/reports';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const data = await getDashboardMetricsService(from, to);
  return { status: 200, body: data, resourceType: 'dashboard' };
});

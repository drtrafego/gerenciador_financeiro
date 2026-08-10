import { withAgentAuth } from '@/lib/agent/route';
import { getOverdueReportService } from '@/lib/agent/services/reports';

export const GET = withAgentAuth(async () => {
  const data = await getOverdueReportService();
  return { status: 200, body: data, resourceType: 'invoice' };
});

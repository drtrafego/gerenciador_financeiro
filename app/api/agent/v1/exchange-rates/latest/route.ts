import { withAgentAuth } from '@/lib/agent/route';
import { getLatestExchangeRateService } from '@/lib/agent/services/reports';
import { notFound } from '@/lib/agent/errors';

export const GET = withAgentAuth(async () => {
  const rate = await getLatestExchangeRateService();
  if (!rate) throw notFound('Cotação');
  return { status: 200, body: rate, resourceType: 'dashboard' };
});

import { withAgentAuth } from '@/lib/agent/route';
import { getInvoiceDetail } from '@/lib/agent/services/invoices';

export const GET = withAgentAuth<{ id: string }>(async ({ params }) => {
  const invoice = await getInvoiceDetail(params.id);
  return { status: 200, body: invoice, resourceType: 'invoice', resourceId: params.id };
});

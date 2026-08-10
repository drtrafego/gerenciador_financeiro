import { withAgentAuth } from '@/lib/agent/route';
import { updateInvoiceStatusService } from '@/lib/agent/services/invoices';

// Só aceita draft | sent | cancelled. NUNCA "paid" por aqui — use /mark-paid.
export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const input = await request.json();
  const { before, after, parsed } = await updateInvoiceStatusService(params.id, input);
  return {
    status: 200,
    body: after,
    resourceType: 'invoice',
    resourceId: params.id,
    requestBody: parsed,
    beforeData: before,
    afterData: after,
  };
});

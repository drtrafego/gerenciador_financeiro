import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { listInvoices, createInvoiceService } from '@/lib/agent/services/invoices';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const { data, count } = await listInvoices({ limit, offset });
  return { status: 200, body: { data, count }, resourceType: 'invoice' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { invoice, parsed } = await createInvoiceService(input);
  return {
    status: 201,
    body: invoice,
    resourceType: 'invoice',
    resourceId: invoice.id,
    requestBody: parsed,
    afterData: invoice,
  };
});

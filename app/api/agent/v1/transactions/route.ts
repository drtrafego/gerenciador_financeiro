import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { listTransactions, createTransactionService } from '@/lib/agent/services/transactions';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const typeParam = url.searchParams.get('type');
  const type = typeParam === 'income' || typeParam === 'expense' ? typeParam : undefined;
  const clientId = url.searchParams.get('clientId') ?? undefined;

  const { data, count } = await listTransactions({ from, to, type, clientId, limit, offset });
  return { status: 200, body: { data, count }, resourceType: 'transaction' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { transactions, parsed } = await createTransactionService(input);
  const first = transactions[0];
  return {
    status: 201,
    body: { data: transactions, count: transactions.length },
    resourceType: 'transaction',
    resourceId: first?.id,
    requestBody: parsed,
    afterData: transactions,
  };
});

import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import {
  listPersonalTransactions,
  createPersonalTransactionsService,
  updatePersonalTransactionService,
  deletePersonalTransactionsService,
} from '@/lib/agent/services/personalTransactions';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;
  const type = url.searchParams.get('type') || undefined;
  const currency = url.searchParams.get('currency')?.toUpperCase() || undefined;
  const category = url.searchParams.get('category') || undefined;
  const person = (
    url.searchParams.get('childTag') ||
    url.searchParams.get('member') ||
    url.searchParams.get('person') ||
    url.searchParams.get('titular') ||
    url.searchParams.get('responsavel') ||
    ''
  ).trim() || undefined;
  const search = (
    url.searchParams.get('q') ||
    url.searchParams.get('search') ||
    ''
  ).trim() || undefined;
  const id = url.searchParams.get('id') || undefined;
  const hideTransfers =
    url.searchParams.get('hideTransfers') === 'true' ||
    url.searchParams.get('hideTransfers') === '1';

  const result = await listPersonalTransactions({
    from,
    to,
    type,
    currency,
    category,
    person,
    search,
    id,
    hideTransfers,
    limit,
    offset,
  });

  return {
    status: 200,
    body: {
      data: result.data,
      count: result.count,
      total: result.total,
      limit,
      offset,
    },
    resourceType: 'personal_transaction',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await createPersonalTransactionsService(body);
  const first = result.transactions[0];

  return {
    status: 201,
    body: {
      data: result.transactions.length === 1 ? first : result.transactions,
      count: result.count,
      message: result.message,
    },
    resourceType: 'personal_transaction',
    resourceId: first?.id,
    requestBody: body,
    afterData: result.transactions,
  };
});

export const PATCH = withAgentAuth(async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const id = body.id || url.searchParams.get('id');

  const { before, after } = await updatePersonalTransactionService(id, body);

  return {
    status: 200,
    body: {
      data: after,
      message: `Transação ${id} atualizada com sucesso.`,
    },
    resourceType: 'personal_transaction',
    resourceId: id,
    requestBody: body,
    beforeData: before,
    afterData: after,
  };
});

export const PUT = PATCH;

export const DELETE = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  let idFromQuery = url.searchParams.get('id');
  let idsToDelete: string[] = [];

  if (idFromQuery) {
    idsToDelete.push(idFromQuery);
  } else {
    try {
      const body = await request.json();
      if (body?.id) idsToDelete.push(body.id);
      if (Array.isArray(body?.ids)) idsToDelete.push(...body.ids);
    } catch {}
  }

  const result = await deletePersonalTransactionsService(idsToDelete);

  return {
    status: 200,
    body: {
      success: true,
      deletedIds: result.deletedIds,
      count: result.count,
      message: result.message,
    },
    resourceType: 'personal_transaction',
    resourceId: result.deletedIds[0],
  };
});

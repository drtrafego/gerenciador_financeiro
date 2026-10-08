import { withAgentAuth } from '@/lib/agent/route';
import { notFound } from '@/lib/agent/errors';
import {
  getPersonalTransactionDetail,
  updatePersonalTransactionService,
  deletePersonalTransactionsService,
} from '@/lib/agent/services/personalTransactions';

export const GET = withAgentAuth<{ id: string }>(async ({ params }) => {
  const transaction = await getPersonalTransactionDetail(params.id);
  if (!transaction) {
    throw notFound(`Transação pessoal ${params.id}`);
  }

  return {
    status: 200,
    body: { data: transaction },
    resourceType: 'personal_transaction',
    resourceId: params.id,
  };
});

export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { before, after } = await updatePersonalTransactionService(params.id, body);

  return {
    status: 200,
    body: {
      data: after,
      message: `Transação ${params.id} atualizada com sucesso.`,
    },
    resourceType: 'personal_transaction',
    resourceId: params.id,
    requestBody: body,
    beforeData: before,
    afterData: after,
  };
});

export const PUT = PATCH;

export const DELETE = withAgentAuth<{ id: string }>(async ({ params }) => {
  const result = await deletePersonalTransactionsService([params.id]);

  return {
    status: 200,
    body: {
      success: true,
      deletedId: params.id,
      message: `Transação ${params.id} removida com sucesso.`,
    },
    resourceType: 'personal_transaction',
    resourceId: params.id,
  };
});

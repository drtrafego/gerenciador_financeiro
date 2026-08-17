import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { badRequest } from '@/lib/agent/errors';
import { listOpenDuesService } from '@/lib/agent/services/billing';

// Vencimentos de contratos ativos na janela pedida, com o estado do ciclo de
// cobrança de cada um. Pelo menos um filtro é obrigatório (phone, clientId ou
// contractId): esta rota não lista a base inteira.
export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);

  const phone = url.searchParams.get('phone') ?? undefined;
  const clientId = url.searchParams.get('clientId') ?? undefined;
  const contractId = url.searchParams.get('contractId') ?? undefined;
  if (!phone && !clientId && !contractId) {
    throw badRequest('Informe pelo menos um filtro: phone, clientId ou contractId.');
  }

  const daysParam = url.searchParams.get('days');
  const days = daysParam === null ? 45 : Number(daysParam);
  if (!Number.isFinite(days)) throw badRequest('days: precisa ser um número.');

  const { data, count } = await listOpenDuesService(
    { phone, clientId, contractId, days: Math.floor(days) },
    { limit, offset }
  );
  return { status: 200, body: { data, count }, resourceType: 'billing' };
});

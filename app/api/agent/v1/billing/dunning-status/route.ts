import { withAgentAuth } from '@/lib/agent/route';
import { badRequest } from '@/lib/agent/errors';
import { getDunningStatusService } from '@/lib/agent/services/billing';

// Ciclo completo de um vencimento: estado derivado mais todas as linhas de
// reminders daquele ciclo (mensagem enviada, erro e horário do envio).
export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const contractId = url.searchParams.get('contractId');
  if (!contractId) throw badRequest('contractId é obrigatório.');
  const dueDate = url.searchParams.get('dueDate') ?? undefined;

  const { item, reminders, confirmation } = await getDunningStatusService({ contractId, dueDate });
  return {
    status: 200,
    body: { ...item, reminders, confirmation },
    resourceType: 'billing',
    resourceId: `${item.contractId}:${item.dueDate}`,
  };
});

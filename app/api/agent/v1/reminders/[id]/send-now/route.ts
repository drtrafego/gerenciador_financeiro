import { withAgentAuth } from '@/lib/agent/route';
import { sendNowReminderService } from '@/lib/agent/services/reminders';

// Busca o reminder, resolve a mensagem via lib/wpp/send.ts, chama o whatsapp-service
// e atualiza status/sentAt/errorMessage do reminder — mesmo caminho que o cron usa hoje.
export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before, after, sent, error } = await sendNowReminderService(params.id);
  return {
    status: 200,
    body: { reminder: after, sent, error },
    resourceType: 'reminder',
    resourceId: params.id,
    beforeData: before,
    afterData: after,
  };
});

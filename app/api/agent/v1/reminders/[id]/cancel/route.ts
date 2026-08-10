import { withAgentAuth } from '@/lib/agent/route';
import { cancelReminderService } from '@/lib/agent/services/reminders';

export const POST = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before, after } = await cancelReminderService(params.id);
  return {
    status: 200,
    body: after,
    resourceType: 'reminder',
    resourceId: params.id,
    beforeData: before,
    afterData: after,
  };
});

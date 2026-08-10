import { withAgentAuth } from '@/lib/agent/route';
import { updateReminderService, deleteReminderService } from '@/lib/agent/services/reminders';

export const PATCH = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const input = await request.json();
  const { before, after, parsed } = await updateReminderService(params.id, input);
  return {
    status: 200,
    body: after,
    resourceType: 'reminder',
    resourceId: params.id,
    requestBody: parsed,
    beforeData: before,
    afterData: after,
  };
});

// Único recurso com DELETE de verdade na API: lembrete não é dado fiscal.
export const DELETE = withAgentAuth<{ id: string }>(async ({ params }) => {
  const { before } = await deleteReminderService(params.id);
  return {
    status: 200,
    body: { deleted: true },
    resourceType: 'reminder',
    resourceId: params.id,
    beforeData: before,
  };
});

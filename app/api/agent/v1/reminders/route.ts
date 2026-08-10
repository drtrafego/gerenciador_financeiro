import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { listReminders, createReminderService } from '@/lib/agent/services/reminders';

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const status = url.searchParams.get('status') ?? undefined;
  const { data, count } = await listReminders({ status, limit, offset });
  return { status: 200, body: { data, count }, resourceType: 'reminder' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { reminder, parsed } = await createReminderService(input);
  return {
    status: 201,
    body: reminder,
    resourceType: 'reminder',
    resourceId: reminder.id,
    requestBody: parsed,
    afterData: reminder,
  };
});

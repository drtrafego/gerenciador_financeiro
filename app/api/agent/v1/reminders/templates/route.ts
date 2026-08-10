import { withAgentAuth } from '@/lib/agent/route';
import { listMessageTemplatesService, createMessageTemplateService } from '@/lib/agent/services/reminders';

export const GET = withAgentAuth(async () => {
  const data = await listMessageTemplatesService();
  return { status: 200, body: { data, count: data.length }, resourceType: 'reminder' };
});

export const POST = withAgentAuth(async ({ request }) => {
  const input = await request.json();
  const { template, parsed } = await createMessageTemplateService(input);
  return {
    status: 201,
    body: template,
    resourceType: 'reminder',
    resourceId: template.id,
    requestBody: parsed,
    afterData: template,
  };
});

import { withAgentAuth } from '@/lib/agent/route';
import { z } from 'zod';

const createDependentSchema = z.object({
  name: z.string().min(1),
});

export const GET = withAgentAuth(async () => {
  return {
    status: 200,
    body: {
      data: [],
    },
    resourceType: 'personal_dependents',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = createDependentSchema.parse(body);

  return {
    status: 201,
    body: {
      message: `Dependente/Filho ${parsed.name} adicionado com sucesso!`,
      name: parsed.name,
    },
    resourceType: 'personal_dependents',
    requestBody: parsed,
  };
});

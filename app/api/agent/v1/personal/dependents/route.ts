import { withAgentAuth } from '@/lib/agent/route';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const DEPENDENTS_KEY = 'personal_dependents';
const DEFAULT_DEPENDENTS = ['Matheus', 'Sofia', 'Colégio Misericórdia'];
const FAMILY_HOLDERS = ['Gastão', 'Amanda'];

const postDependentSchema = z.object({
  name: z.string().optional(),
  dependents: z.array(z.string()).optional(),
});

async function getSavedDependents(): Promise<string[]> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, DEPENDENTS_KEY))
      .limit(1);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const filePath = path.join(process.cwd(), 'data', 'personal_dependents.json');
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  return DEFAULT_DEPENDENTS;
}

async function saveDependents(list: string[]) {
  const jsonStr = JSON.stringify(list);
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, DEPENDENTS_KEY))
      .limit(1);
    if (existing) {
      await db
        .update(systemSettings)
        .set({ value: jsonStr, updatedAt: new Date() })
        .where(eq(systemSettings.key, DEPENDENTS_KEY));
    } else {
      await db
        .insert(systemSettings)
        .values({ key: DEPENDENTS_KEY, value: jsonStr });
    }
  } catch {}

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'personal_dependents.json'), jsonStr, 'utf8');
  } catch {}
}

export const GET = withAgentAuth(async () => {
  const dependents = await getSavedDependents();

  return {
    status: 200,
    body: {
      data: dependents,
      members: FAMILY_HOLDERS,
      count: dependents.length,
    },
    resourceType: 'personal_dependents',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = postDependentSchema.parse(body);

  let current = await getSavedDependents();

  if (Array.isArray(parsed.dependents) && parsed.dependents.length > 0) {
    current = Array.from(new Set(parsed.dependents));
  } else if (parsed.name && parsed.name.trim()) {
    const cleanName = parsed.name.trim();
    if (!current.includes(cleanName)) {
      current.push(cleanName);
    }
  }

  await saveDependents(current);

  return {
    status: 201,
    body: {
      success: true,
      data: current,
      members: FAMILY_HOLDERS,
      message: 'Dependentes atualizados com sucesso!',
    },
    resourceType: 'personal_dependents',
    requestBody: parsed,
  };
});

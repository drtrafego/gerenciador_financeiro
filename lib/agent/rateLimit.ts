import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentAuditLog } from '@/lib/db/schema';

const DEFAULT_LIMIT_PER_MINUTE = 60;

// Conta quantas chamadas esse actor fez no último minuto (via agent_audit_log)
// e compara com o limite configurado. true = excedeu, deve responder 429.
export async function isRateLimited(actor: string): Promise<boolean> {
  const limit = Number(process.env.AGENT_RATE_LIMIT_PER_MINUTE ?? DEFAULT_LIMIT_PER_MINUTE);
  if (!Number.isFinite(limit) || limit <= 0) return false;

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentAuditLog)
    .where(
      sql`${agentAuditLog.actor} = ${actor} AND ${agentAuditLog.createdAt} > now() - interval '1 minute'`
    );

  const count = Number(row?.count ?? 0);
  return count >= limit;
}

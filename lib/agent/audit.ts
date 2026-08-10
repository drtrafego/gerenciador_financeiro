import { db } from '@/lib/db';
import { agentAuditLog } from '@/lib/db/schema';

export type AgentAuditEntry = {
  actor: string;
  method: string;
  endpoint: string;
  resourceType?: string | null;
  resourceId?: string | null;
  requestBody?: unknown;
  beforeData?: unknown;
  afterData?: unknown;
  statusCode: number;
  success: boolean;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
};

// Insere uma linha de auditoria para uma chamada do super agente externo.
// Nunca deve lançar exceção que derrube a resposta HTTP principal.
export async function logAgentCall(entry: AgentAuditEntry): Promise<void> {
  try {
    await db.insert(agentAuditLog).values({
      actor: entry.actor,
      method: entry.method,
      endpoint: entry.endpoint,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      requestBody: entry.requestBody ?? null,
      beforeData: entry.beforeData ?? null,
      afterData: entry.afterData ?? null,
      statusCode: entry.statusCode,
      success: entry.success,
      errorMessage: entry.errorMessage ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      durationMs: entry.durationMs ?? null,
    });
  } catch (err) {
    console.error('[agent-audit] falha ao gravar log de auditoria:', err);
  }
}

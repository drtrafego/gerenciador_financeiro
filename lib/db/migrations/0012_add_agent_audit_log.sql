-- Log de auditoria de toda chamada feita pelo super agente externo (API em
-- app/api/agent/v1/**), inclusive leituras. Nunca lançar exceção que derrube
-- a resposta HTTP principal quando a escrita aqui falhar (ver lib/agent/audit.ts).
CREATE TABLE IF NOT EXISTS "agent_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor" text DEFAULT 'agent' NOT NULL,
  "method" text NOT NULL,
  "endpoint" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "request_body" jsonb,
  "before_data" jsonb,
  "after_data" jsonb,
  "status_code" integer NOT NULL,
  "success" boolean NOT NULL,
  "error_message" text,
  "ip" text,
  "user_agent" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_audit_log_actor_created_at_idx
  ON agent_audit_log (actor, created_at);

CREATE INDEX IF NOT EXISTS agent_audit_log_endpoint_created_at_idx
  ON agent_audit_log (endpoint, created_at);

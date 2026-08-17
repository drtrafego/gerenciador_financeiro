-- Cobrança de atraso (D+2 e D+5) e confirmação de pagamento.
--
-- Migração 100% aditiva: nenhuma linha existente muda de significado, nenhum
-- dado é apagado e nenhuma coluna é removida. Toda linha histórica de reminders
-- criada pelo cron representa o aviso do dia do vencimento, então a coluna nova
-- "stage" nasce com o valor 'due', que é exatamente o que essas linhas já eram.
-- As linhas avulsas (contract_id nulo) também recebem 'due' e continuam fora do
-- índice de unicidade, que é parcial (só vale quando contract_id não é nulo).
--
-- O índice único novo (contract_id, trigger_date, stage) é criado ANTES de
-- derrubar o antigo (contract_id, trigger_date), para nunca existir uma janela
-- sem garantia de unicidade no meio da migração.
--
-- payment_confirmations vive em tabela própria porque lembrete pode ser apagado
-- (existe DELETE /reminders/:id) e a confirmação de pagamento não pode sumir junto.
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "stage" text DEFAULT 'due' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS reminders_contract_duedate_stage_unique
  ON reminders (contract_id, trigger_date, stage)
  WHERE contract_id IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS reminders_contract_duedate_unique;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reminders_stage_triggerdate_idx
  ON reminders (stage, trigger_date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_confirmations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid REFERENCES clients(id),
  "contract_id" uuid NOT NULL REFERENCES contracts(id),
  "due_date" date NOT NULL,
  "amount" numeric(10, 2),
  "source" text DEFAULT 'panel' NOT NULL,
  "actor" text,
  "note" text,
  "confirmed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_confirmations_contract_duedate_unique
  ON payment_confirmations (contract_id, due_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_confirmations_duedate_idx
  ON payment_confirmations (due_date);

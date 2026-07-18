-- Impede que um mesmo contrato gere mais de um lembrete para a mesma data de
-- vencimento (a data canônica do mês). Garante idempotência do cron de cobrança
-- automática mesmo sob execução concorrente ou reexecução (catch-up).
CREATE UNIQUE INDEX IF NOT EXISTS reminders_contract_duedate_unique
  ON reminders (contract_id, trigger_date)
  WHERE contract_id IS NOT NULL;

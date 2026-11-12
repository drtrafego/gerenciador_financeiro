-- Renovação automática por contrato. Padrão true: contrato ativo segue cobrando após o end_date.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;

-- Fila de envio do recibo por e-mail.
--
-- Confirmar um pagamento passa a emitir a fatura quitada e mandar o recibo ao
-- cliente. O envio NÃO acontece dentro da requisição: o SMTP leva segundos e o
-- dono confirma vários pagamentos seguidos. A fatura nasce com o envio pendente
-- e um cron drena a fila, com nova tentativa quando o SMTP falha.
--
-- Estados de receipt_email_status:
--   null            fatura que não veio de confirmação automática (não envia nada)
--   pending         na fila, aguardando envio
--   sending         reivindicada por uma execução, envio em andamento
--   sent            recibo entregue ao SMTP
--   skipped_no_email  cliente sem e-mail cadastrado, nada a enviar
--   failed          esgotou as tentativas, precisa de ação manual
--
-- O estado "sending" existe porque duas execuções podem tentar enviar o mesmo
-- recibo (o envio logo após a confirmação e o cron de retry). Quem consegue
-- mudar a linha de pending para sending é quem envia; a outra execução vê que
-- não reivindicou nada e sai. receipt_email_claimed_at permite destravar uma
-- linha cuja execução morreu no meio.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_status text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_to text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_sent_at timestamp;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_error text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_email_claimed_at timestamp;

-- O cron busca o que está na fila e o que ficou preso em envio, então o índice
-- cobre os dois estados.
CREATE INDEX IF NOT EXISTS invoices_receipt_email_pending_idx
  ON invoices (receipt_email_status)
  WHERE receipt_email_status IN ('pending', 'sending');

-- Uma fatura viva por ciclo de contrato. É o que impede duas faturas para o
-- mesmo vencimento quando o dono desfaz e refaz a confirmação. Fatura cancelada
-- fica de fora de propósito: depois de cancelar, emitir de novo é legítimo.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_contract_duedate_alive_unique
  ON invoices (contract_id, due_date)
  WHERE contract_id IS NOT NULL AND status <> 'cancelled';

// Envio do recibo por e-mail, o dreno da fila.
//
// Chamado de dois lugares: logo depois de confirmar um pagamento (via after(),
// já com a resposta entregue ao navegador, para o SMTP não segurar a tela) e
// pelo cron, que reprocessa o que falhou ou ficou preso. Os dois caminhos podem
// pegar a mesma fatura ao mesmo tempo, por isso a linha é REIVINDICADA antes do
// envio: quem consegue mudar de "pending" para "sending" é quem manda o e-mail,
// e a outra execução sai sem fazer nada. Ler o estado e só depois atualizar não
// bastaria, porque as duas leriam "pending" e o cliente receberia dois recibos.

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices, clients } from '@/lib/db/schema';
import { sendReceiptEmail } from '@/lib/email/gmail';
import { formatCurrency, type Currency } from '@/lib/currency/format';
import { markReceiptFailed, markReceiptSent } from './receipts';

// Envia o recibo de UMA fatura da fila. Nunca lança: a falha vira estado na
// própria linha, para o cron tentar de novo e a tela conseguir mostrar o motivo.
export async function sendReceiptForInvoice(invoiceId: string): Promise<{ ok: boolean; error: string | null }> {
  const [claimed] = await db
    .update(invoices)
    .set({ receiptEmailStatus: 'sending', receiptEmailClaimedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.receiptEmailStatus, 'pending')))
    .returning();

  // Não reivindicou: outra execução está enviando agora, já enviou, ou a fatura
  // nem está na fila. Nos três casos não há nada a fazer aqui.
  if (!claimed) return { ok: true, error: null };

  const [cliente] = claimed.clientId
    ? await db.select().from(clients).where(eq(clients.id, claimed.clientId)).limit(1)
    : [];

  const to = (claimed.receiptEmailTo ?? cliente?.email ?? '').trim();
  if (!to) {
    await db
      .update(invoices)
      .set({ receiptEmailStatus: 'skipped_no_email' })
      .where(eq(invoices.id, invoiceId));
    return { ok: false, error: 'Cliente sem e-mail cadastrado' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    await sendReceiptEmail({
      to,
      clientName: cliente?.name ?? 'Cliente',
      invoiceNumber: claimed.invoiceNumber ?? claimed.id,
      amount: formatCurrency(parseFloat(claimed.amount ?? '0'), (claimed.currency as Currency) ?? 'BRL'),
      dueDate: claimed.dueDate,
      description: claimed.description ?? 'Serviços de gestão de tráfego pago',
      receiptUrl: `${appUrl}/invoice/${claimed.id}`,
      isPaid: claimed.status === 'paid',
      paidAt: claimed.paidAt ? claimed.paidAt.toISOString() : null,
    });
    // Risco residual conhecido e aceito: se o processo morrer entre a entrega ao
    // SMTP e este UPDATE, a linha fica presa em "sending", o destravamento por
    // tempo a devolve para a fila e o cliente recebe o recibo duas vezes. Fechar
    // isso exigiria idempotência do lado do provedor de e-mail.
    await markReceiptSent(claimed.id);
    return { ok: true, error: null };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Falha no envio do recibo';
    await markReceiptFailed(claimed.id, claimed.receiptEmailAttempts, mensagem);
    return { ok: false, error: mensagem };
  }
}

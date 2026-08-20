'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { unconfirmPayment, BillingNotFoundError, BillingValidationError } from '@/lib/billing/confirmations';
import { confirmPaymentAndIssueReceipt, findAliveInvoiceNumber } from '@/lib/billing/receipts';
import { sendReceiptForInvoice } from '@/lib/billing/sendReceipt';

// Marcar como pago direto no fluxo de caixa, que é onde o dono confere dinheiro.
// Antes isso só existia na aba de lembretes do WhatsApp, e o dashboard passou a
// depender da confirmação para dizer o que entrou de verdade.
//
// A confirmação emite a fatura quitada e coloca o recibo na fila. O e-mail sai
// depois da resposta (after), para o SMTP não segurar a tela; se falhar ali, o
// cron /api/cron/send-receipts tenta de novo.

export type MarkPaidResult = {
  ok: boolean;
  message: string;
  invoiceNumber?: string | null;
  emailTo?: string | null;
  emailSkipped?: boolean;
};

export async function markContractPaidAction(
  contractId: string,
  dueDate: string
): Promise<MarkPaidResult> {
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');

  try {
    const resultado = await confirmPaymentAndIssueReceipt({
      contractId,
      dueDate,
      source: 'panel',
      actor: 'painel',
      note: 'Confirmado no fluxo de caixa',
    });

    revalidatePath('/cash-flow');
    revalidatePath('/dashboard');
    revalidatePath('/reminders');
    revalidatePath('/invoices');

    if (resultado.alreadyConfirmed) {
      return { ok: true, message: 'Este vencimento já estava confirmado como pago.' };
    }

    if (resultado.error) {
      return {
        ok: true,
        message: `Pagamento confirmado, mas a fatura não foi emitida: ${resultado.error}`,
      };
    }

    const invoice = resultado.invoice;
    if (invoice && resultado.emailStatus === 'pending') {
      // Envia com a resposta já entregue ao navegador.
      after(async () => {
        await sendReceiptForInvoice(invoice.id);
      });
      return {
        ok: true,
        message: `Pagamento confirmado. Fatura ${invoice.invoiceNumber} emitida e recibo a caminho de ${resultado.emailTo}.`,
        invoiceNumber: invoice.invoiceNumber,
        emailTo: resultado.emailTo,
      };
    }

    if (invoice && resultado.emailStatus === 'skipped_no_email') {
      return {
        ok: true,
        message: `Pagamento confirmado e fatura ${invoice.invoiceNumber} emitida. O recibo NÃO foi enviado porque este cliente não tem e-mail cadastrado.`,
        invoiceNumber: invoice.invoiceNumber,
        emailSkipped: true,
      };
    }

    return { ok: true, message: 'Pagamento confirmado.' };
  } catch (err) {
    if (err instanceof BillingNotFoundError || err instanceof BillingValidationError) {
      return { ok: false, message: err.message };
    }
    console.error('[cash-flow] falha ao confirmar pagamento:', err);
    return { ok: false, message: 'Não foi possível confirmar o pagamento.' };
  }
}

export async function undoContractPaymentAction(
  contractId: string,
  dueDate: string
): Promise<MarkPaidResult> {
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');

  try {
    // A fatura emitida NÃO é cancelada junto: o recibo já pode ter chegado ao
    // cliente, e desfazer aqui é correção de registro, não estorno. Se a fatura
    // precisa sumir, é uma ação consciente na tela de faturas.
    const numeroFatura = await findAliveInvoiceNumber(contractId, dueDate);
    await unconfirmPayment({ contractId, dueDate });

    revalidatePath('/cash-flow');
    revalidatePath('/dashboard');
    revalidatePath('/reminders');

    return {
      ok: true,
      message: numeroFatura
        ? `Confirmação desfeita. A fatura ${numeroFatura} continua emitida, cancele por Faturas se for o caso.`
        : 'Confirmação desfeita.',
      invoiceNumber: numeroFatura,
    };
  } catch (err) {
    if (err instanceof BillingNotFoundError || err instanceof BillingValidationError) {
      return { ok: false, message: err.message };
    }
    console.error('[cash-flow] falha ao desfazer confirmação:', err);
    return { ok: false, message: 'Não foi possível desfazer a confirmação.' };
  }
}

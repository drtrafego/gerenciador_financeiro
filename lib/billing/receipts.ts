// Emissão do recibo quando um pagamento é confirmado.
//
// Esta camada fica ACIMA de lib/billing/confirmations.ts de propósito. O módulo
// de confirmação continua puro (não cria fatura, não lança transação, não mexe
// no cadastro do cliente), porque ele é chamado também pelo cron de cobrança e
// pela API do agente, e nenhum deles deve emitir documento como efeito colateral.
// Quem quer o pacote completo (confirmar, emitir a fatura quitada e mandar o
// recibo) chama daqui.
//
// Travas para nunca emitir duas vezes o mesmo recibo:
// 1. Só emite quando a confirmação foi criada AGORA (`alreadyConfirmed === false`).
//    Isso mata o clique duplo, porque a segunda chamada esbarra na chave única
//    (contract_id, due_date) e volta como já confirmada. É também o que protege
//    o backfill histórico: aquelas confirmações já existem, então reconfirmar
//    qualquer uma delas cai neste caminho e não emite nada.
// 2. Antes de criar, procura fatura viva do mesmo ciclo. Se existir (o dono fez
//    à mão, ou desfez e refez a confirmação), reaproveita em vez de duplicar.
// 3. Confirmação de origem `migration` nunca emite.
//
// NÃO existe barreira por data de vencimento, e isso é deliberado. A primeira
// versão tinha uma, gravada na primeira execução, e ela bloqueava justamente o
// uso normal: confirmar hoje um pagamento que venceu dias atrás é o caso comum,
// não a exceção, e o dono não veria aviso nenhum de que a fatura não saiu.
//
// A confirmação é o dado crítico: se a emissão da fatura falhar, a confirmação
// permanece de pé e o erro volta como aviso, nunca desfazendo o registro do
// pagamento.

import { and, eq, ne, lt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, contracts, invoices, type Invoice } from '@/lib/db/schema';
import { createInvoice } from '@/lib/db/queries';
import { confirmPayment } from './confirmations';

export type ReceiptOutcome = {
  alreadyConfirmed: boolean;
  invoice: Invoice | null;
  /** Por que não emitiu, quando não emitiu. Quem chama precisa mostrar isso na
   *  tela: emitir nada em silêncio faz o operador achar que o recibo saiu. */
  skipped: 'ja_confirmado' | 'confirmacao_historica' | 'cliente_de_teste' | 'desligado' | null;
  emailStatus: 'pending' | 'skipped_no_email' | null;
  emailTo: string | null;
  /** Falha na emissão da fatura. A confirmação continua valendo. */
  error: string | null;
};

// Fatura viva daquele ciclo: mesma dupla contrato e vencimento, ignorando as
// canceladas (depois de cancelar, emitir de novo é legítimo).
export async function findInvoiceForCycle(contractId: string, dueDate: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.contractId, contractId),
        eq(invoices.dueDate, dueDate),
        ne(invoices.status, 'cancelled')
      )
    )
    .limit(1);
  return invoice ?? null;
}

export async function confirmPaymentAndIssueReceipt({
  contractId,
  dueDate,
  amount,
  source,
  actor,
  note,
  issueInvoice = true,
  sendEmail = true,
}: {
  contractId: string;
  dueDate: string;
  amount?: number | string | null;
  source: 'panel' | 'agent';
  actor?: string | null;
  note?: string | null;
  issueInvoice?: boolean;
  sendEmail?: boolean;
}): Promise<ReceiptOutcome> {
  const { confirmation, alreadyConfirmed } = await confirmPayment({
    contractId,
    dueDate,
    amount,
    source,
    actor,
    note,
  });

  const base: ReceiptOutcome = {
    alreadyConfirmed,
    invoice: null,
    skipped: null,
    emailStatus: null,
    emailTo: null,
    error: null,
  };

  if (!issueInvoice) return { ...base, skipped: 'desligado' };
  if (alreadyConfirmed) {
    // Já existia confirmação: o recibo daquele ciclo já foi tratado quando ela
    // nasceu. Devolve a fatura existente só para a tela poder mostrar o número.
    return { ...base, skipped: 'ja_confirmado', invoice: await findInvoiceForCycle(contractId, dueDate) };
  }

  // Guarda defensiva: linha de backfill nunca vira recibo. Hoje o schema de
  // confirmação só aceita panel e agent, então isso só pega o caso de alguém
  // gravar direto no banco de novo.
  if (confirmation.source === 'migration') return { ...base, skipped: 'confirmacao_historica' };

  const [row] = await db
    .select({ contract: contracts, client: clients })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (row?.client?.isTest) return { ...base, skipped: 'cliente_de_teste' };

  const email = (row?.client?.email ?? '').trim();
  const emailStatus: 'pending' | 'skipped_no_email' =
    sendEmail && email ? 'pending' : 'skipped_no_email';

  try {
    const existente = await findInvoiceForCycle(contractId, dueDate);
    if (existente) {
      // Fatura já existia para este ciclo. Marca como paga se ainda não estiver
      // e coloca o recibo na fila, sem criar documento novo.
      const [atualizada] = await db
        .update(invoices)
        .set({
          status: 'paid',
          paidAt: existente.paidAt ?? confirmation.confirmedAt,
          receiptEmailStatus: existente.receiptEmailStatus === 'sent' ? 'sent' : emailStatus,
          receiptEmailTo: email || null,
        })
        .where(eq(invoices.id, existente.id))
        .returning();
      return {
        ...base,
        invoice: atualizada ?? existente,
        emailStatus: existente.receiptEmailStatus === 'sent' ? null : emailStatus,
        emailTo: email || null,
      };
    }

    const nomeServico = (row?.contract?.name ?? '').trim() || 'Serviço';
    const invoice = await createInvoice({
      clientId: row?.contract?.clientId ?? null,
      contractId,
      type: 'monthly',
      amount: confirmation.amount ?? row?.contract?.fixedAmount ?? '0',
      currency: row?.contract?.currency ?? 'BRL',
      status: 'paid',
      dueDate,
      paidAt: confirmation.confirmedAt,
      description: `${nomeServico}, vencimento ${dueDate.split('-').reverse().join('/')}`,
      receiptEmailStatus: emailStatus,
      receiptEmailTo: email || null,
    });

    return { ...base, invoice, emailStatus, emailTo: email || null };
  } catch (err) {
    // Fatura é consequência; confirmação é o que não pode se perder.
    console.error('[receipts] falha ao emitir fatura da confirmação:', err);
    return {
      ...base,
      error: err instanceof Error ? err.message : 'Falha ao emitir a fatura',
    };
  }
}

// Quanto tempo uma linha pode ficar reivindicada antes de ser considerada presa.
// Uma função da Vercel não passa disso, então acima deste tempo o envio anterior
// certamente morreu no meio.
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

// Faturas com recibo pendente de envio, para o cron drenar. Inclui as que ficaram
// presas em "sending" (a execução que reivindicou morreu antes de terminar),
// devolvendo-as para a fila.
export async function getPendingReceipts(limit: number) {
  const limite = new Date(Date.now() - CLAIM_TIMEOUT_MS);

  await db
    .update(invoices)
    .set({ receiptEmailStatus: 'pending' })
    .where(and(eq(invoices.receiptEmailStatus, 'sending'), lt(invoices.receiptEmailClaimedAt, limite)));

  return db
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.receiptEmailStatus, 'pending'))
    .limit(limit);
}

// Faturas sem cliente vinculado nunca entram na fila, então esta função existe
// só para o cron não precisar conhecer o schema.
export async function markReceiptSent(invoiceId: string) {
  await db
    .update(invoices)
    .set({ receiptEmailStatus: 'sent', receiptEmailSentAt: new Date(), receiptEmailError: null })
    .where(eq(invoices.id, invoiceId));
}

export const MAX_RECEIPT_ATTEMPTS = 3;

export async function markReceiptFailed(invoiceId: string, attempts: number, error: string) {
  const esgotou = attempts + 1 >= MAX_RECEIPT_ATTEMPTS;
  await db
    .update(invoices)
    .set({
      receiptEmailStatus: esgotou ? 'failed' : 'pending',
      receiptEmailAttempts: attempts + 1,
      receiptEmailError: error,
    })
    .where(eq(invoices.id, invoiceId));
}

// Usado pelo desfazer: a fatura NÃO é cancelada (o recibo já saiu), mas a tela
// precisa avisar que ela continua de pé.
export async function findAliveInvoiceNumber(contractId: string, dueDate: string) {
  const invoice = await findInvoiceForCycle(contractId, dueDate);
  return invoice?.invoiceNumber ?? null;
}

// Não usado hoje, mantido fora do fluxo: existe para o dia em que alguém quiser
// listar recibos que falharam sem escrever a query de novo.
export async function getFailedReceipts() {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.receiptEmailStatus, 'failed'), isNull(invoices.receiptEmailSentAt)));
}

import { NextResponse } from 'next/server';
import { getPendingReceipts } from '@/lib/billing/receipts';
import { sendReceiptForInvoice } from '@/lib/billing/sendReceipt';

// Rede de segurança do envio de recibo.
//
// O caminho normal é o envio logo depois da confirmação, ainda na mesma
// execução, com a resposta já entregue ao navegador. Este cron existe para o que
// escapa dali: SMTP fora do ar no momento da confirmação, função encerrada antes
// de terminar, ou uma fatura que ficou pendente por qualquer outro motivo.
//
// Sequencial de propósito: o Gmail limita envio por minuto, e um lote paralelo
// de recibos derrubaria a conta inteira em vez de atrasar um e-mail.
export const maxDuration = 60;

const LOTE = 20;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const customSecret = request.headers.get('x-cron-secret');
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = customSecret === process.env.CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pendentes = await getPendingReceipts(LOTE);

  let enviados = 0;
  let falhas = 0;
  for (const { invoice } of pendentes) {
    const { ok } = await sendReceiptForInvoice(invoice.id);
    if (ok) enviados++;
    else falhas++;
  }

  return NextResponse.json({ ok: true, processados: pendentes.length, enviados, falhas });
}

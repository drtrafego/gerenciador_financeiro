import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, invoices } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

function resolveMessage(template: string, vars: Record<string, string>) {
  return template
    .replace(/{nome}/g, vars.nome ?? '')
    .replace(/{valor}/g, vars.valor ?? '')
    .replace(/{data}/g, vars.data ?? '')
    .replace(/{dias}/g, vars.dias ?? '');
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${WPP_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WPP_KEY,
      },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!WPP_URL) {
    return NextResponse.json({ error: 'WPP_SERVICE_URL não configurado' }, { status: 500 });
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0]!;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Busca lembretes pendentes para hoje que já passaram do horário
  const pendingRows = await db
    .select({
      reminder: reminders,
      template: messageTemplates,
      client: clients,
      invoice: invoices,
    })
    .from(reminders)
    .leftJoin(messageTemplates, eq(reminders.templateId, messageTemplates.id))
    .leftJoin(clients, eq(reminders.clientId, clients.id))
    .leftJoin(invoices, eq(reminders.invoiceId, invoices.id))
    .where(
      and(
        eq(reminders.status, 'pending'),
        lte(reminders.triggerDate, today)
      )
    );

  // Filtra pelo horário (só envia se já passou da hora configurada)
  const toSend = pendingRows.filter((r) => {
    const reminderTime = r.reminder.triggerTime ?? '08:00';
    return r.reminder.triggerDate < today || reminderTime <= currentTime;
  });

  let sent = 0;
  let failed = 0;

  for (const row of toSend) {
    const { reminder, template, client, invoice } = row;

    let message = reminder.customMessage ?? '';

    if (!message && template?.body) {
      const dueDate = invoice?.dueDate ?? reminder.triggerDate;
      const dueDateFormatted = new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR');
      const daysUntil = Math.ceil(
        (new Date(dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      message = resolveMessage(template.body, {
        nome: client?.name ?? 'Cliente',
        valor: invoice?.amount
          ? `R$ ${parseFloat(invoice.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : '',
        data: dueDateFormatted,
        dias: daysUntil > 0 ? String(daysUntil) : '0',
      });
    }

    if (!message) continue;

    const ok = await sendWhatsApp(reminder.phone, message);

    await db
      .update(reminders)
      .set({
        status: ok ? 'sent' : 'failed',
        sentAt: ok ? new Date() : undefined,
        errorMessage: ok ? null : 'Falha no envio via WhatsApp service',
      })
      .where(eq(reminders.id, reminder.id));

    if (ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, sent, failed, total: toSend.length });
}

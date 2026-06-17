import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-wpp-secret');
  if (!secret || secret !== process.env.WPP_CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // Email sempre que reconectar
  if (process.env.GMAIL_USER) {
    try {
      await sendEmail(
        process.env.GMAIL_USER,
        '✅ WhatsApp Reconectado — DR.TRAFEGO Financeiro',
        `<p>O WhatsApp reconectou em <strong>${now}</strong>. O sistema voltou a funcionar normalmente.</p>`
      );
    } catch {}
  }

  // WhatsApp para número de alerta configurado
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'alert_phone')).limit(1);
  const alertPhone = row?.value;

  if (alertPhone && WPP_URL) {
    try {
      await fetch(`${WPP_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': WPP_KEY },
        body: JSON.stringify({
          phone: alertPhone,
          message: `✅ DR.TRAFEGO Financeiro: WhatsApp reconectado em ${now}.`,
        }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}

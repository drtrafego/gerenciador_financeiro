import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { guardWppCallback } from '@/lib/wpp/callbackGuard';

export async function POST(req: NextRequest) {
  const barrado = guardWppCallback(req);
  if (barrado) return barrado;

  const adminEmail = process.env.GMAIL_USER ?? '';
  if (!adminEmail) return NextResponse.json({ ok: false });

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    await sendEmail(
      adminEmail,
      '⚠️ WhatsApp Desconectado — Casal do Tráfego Financeiro',
      `<p>O WhatsApp do sistema financeiro <strong>desconectou</strong> em <strong>${now}</strong>.</p>
       <p>Acesse <a href="https://financeiro.casaldotrafego.com/reminders">financeiro.casaldotrafego.com/reminders</a> e escaneie o QR code para reconectar.</p>`
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

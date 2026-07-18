import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Proxy server-side do envio de teste. Exige usuário autenticado para não
// virar um relay aberto de mensagens.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });

  if (!WPP_URL) return NextResponse.json({ ok: false, error: 'WhatsApp não configurado' }, { status: 500 });

  let body: { phone?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const { phone, message } = body;
  if (!phone || !message) {
    return NextResponse.json({ ok: false, error: 'phone e message obrigatórios' }, { status: 400 });
  }

  try {
    const res = await fetch(`${WPP_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': WPP_KEY },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'Falha de rede' }, { status: 502 });
  }
}

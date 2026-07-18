import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Proxy server-side: o navegador fala com o próprio site (HTTPS), e o site
// fala com o serviço WhatsApp. Evita mixed-content e mantém a chave no servidor.
export async function GET() {
  if (!WPP_URL) return NextResponse.json({ connected: false, hasQR: false });
  try {
    const res = await fetch(`${WPP_URL}/status`, {
      headers: { 'x-api-key': WPP_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false, hasQR: false });
  }
}

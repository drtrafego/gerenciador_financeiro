import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Proxy server-side do QR code (evita mixed-content no navegador).
export async function GET() {
  if (!WPP_URL) return NextResponse.json({ connected: false, qr: null });
  try {
    const res = await fetch(`${WPP_URL}/qr`, {
      headers: { 'x-api-key': WPP_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false, qr: null });
  }
}

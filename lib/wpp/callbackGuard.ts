import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, isTrustedIp } from '@/lib/security/ipAllowlist';
import { safeCompare } from '@/lib/security/safeCompare';

// Guarda dos callbacks disparados pelo whatsapp-service no VPS
// (/api/wpp/disconnected e /api/wpp/reconnected).
// Devolve a resposta pronta quando barra a chamada, ou null quando pode seguir.
// Não grava em agent_audit_log de propósito: aquela tabela é da API do agente e
// alimenta o rate limit por actor.
export function guardWppCallback(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  if (!isTrustedIp(ip)) {
    console.warn('[wpp-callback] IP não autorizado:', ip, req.nextUrl.pathname);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Contrato de 401 idêntico ao que já existia, o VPS depende desse corpo e status.
  const secret = req.headers.get('x-wpp-secret');
  const esperado = process.env.WPP_CALLBACK_SECRET;
  if (!esperado || !safeCompare(secret ?? '', esperado)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

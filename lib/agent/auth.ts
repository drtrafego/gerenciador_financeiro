import { safeCompare } from '@/lib/security/safeCompare';

// Valida "Authorization: Bearer <token>" contra AGENT_API_KEY e, se definida,
// AGENT_API_KEY_PREVIOUS (permite rotação de chave sem downtime).
export function isValidAgentToken(authorizationHeader: string | null): boolean {
  if (!authorizationHeader) return false;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  const currentKey = process.env.AGENT_API_KEY;
  const previousKey = process.env.AGENT_API_KEY_PREVIOUS;

  if (currentKey && safeCompare(token, currentKey)) return true;
  if (previousKey && safeCompare(token, previousKey)) return true;
  return false;
}

// Ator livre informado pelo agente externo (ex: id do usuário do Telegram).
// Nunca usado para autorizar, só para registrar quem disparou a chamada.
export function getAgentActor(request: Request): string {
  const actor = request.headers.get('x-agent-actor');
  return actor && actor.trim() ? actor.trim() : 'agent';
}

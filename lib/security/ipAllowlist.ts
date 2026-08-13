// Allowlist de IP, segunda camada de defesa das rotas de máquina.
// Não substitui o Bearer da API do agente nem o segredo dos callbacks do WhatsApp,
// só reduz a superfície: quem não vem da origem esperada nem chega a ser autenticado.
// Comparação é igualdade exata de IP, sem suporte a CIDR.

// IP do VPS Hostinger, que hospeda a API consumida pelo agente externo e dispara
// os callbacks do whatsapp-service (/api/wpp/disconnected e /api/wpp/reconnected).
const DEFAULT_TRUSTED_IPS = ['31.97.21.249'];

const RAW = (process.env.TRUSTED_IPS ?? '').trim();

// Kill switch explícito: TRUSTED_IPS=* desliga a camada de IP de propósito.
const DESLIGADA = RAW === '*';

// Normaliza um endereço vindo de header HTTP para o formato usado na comparação.
// Devolve null quando o valor não sobra nada útil depois da limpeza.
export function normalizeIp(valor: string): string | null {
  let ip = valor.trim();
  if (!ip) return null;

  // IPv6 entre colchetes, com ou sem porta: "[2a02::1]:443" vira "2a02::1".
  const comColchetes = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (comColchetes) {
    ip = comColchetes[1].trim();
  } else {
    // IPv4 com porta: só quando existe exatamente um ":" e a parte à esquerda
    // parece IPv4 (contém "."), para nunca cortar um IPv6 cru.
    const partes = ip.split(':');
    if (partes.length === 2 && partes[0].includes('.')) {
      ip = partes[0];
    }
  }

  // IPv4 mapeado em IPv6: "::ffff:31.97.21.249" vira "31.97.21.249".
  const mapeado = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapeado) ip = mapeado[1];

  ip = ip.trim().toLowerCase();
  return ip ? ip : null;
}

// Parse feito uma única vez no carregamento do módulo, nunca por request.
const TRUSTED: string[] = (
  RAW && !DESLIGADA
    ? RAW.split(',').map((item) => normalizeIp(item))
    : DEFAULT_TRUSTED_IPS.map((item) => normalizeIp(item))
).filter((item): item is string => Boolean(item));

if (DESLIGADA) {
  console.warn('[ip-allowlist] allowlist DESLIGADA por TRUSTED_IPS=*, toda origem é aceita');
} else if (!RAW) {
  console.info('[ip-allowlist] TRUSTED_IPS não definida, valendo a lista embutida:', TRUSTED.join(','));
}

// Extrai o IP do chamador dos headers, na ordem de confiança.
// A ordem importa: na Vercel o "x-forwarded-for" é sobrescrito pela plataforma com
// o IP real do cliente e o que vem de fora não é encaminhado (impede spoofing), e
// "x-vercel-forwarded-for" é o header que nem um proxy na frente consegue sobrescrever.
// "x-real-ip" fica por último, é só fallback para ambiente fora da Vercel.
export function getClientIp(request: Request): string | null {
  const headers = ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip'];

  for (const nome of headers) {
    const bruto = request.headers.get(nome);
    if (!bruto) continue;
    const primeiro = bruto.split(',')[0];
    const ip = normalizeIp(primeiro);
    if (ip) return ip;
  }

  return null;
}

export function isTrustedIp(ip: string | null): boolean {
  if (DESLIGADA) return true;
  // Libera só o "next dev" local. Preview na Vercel também roda como production,
  // então preview continua sujeito à allowlist.
  if (process.env.NODE_ENV !== 'production') return true;
  // Em produção, IP ausente é negado. Não conseguir identificar a origem nunca libera.
  if (!ip) return false;
  return TRUSTED.includes(ip);
}

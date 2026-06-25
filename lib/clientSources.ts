// Origem (canal de aquisição) do cliente.
// Código estável no banco + rótulo exibido na interface.

export const CLIENT_SOURCES = [
  { code: 'referral', label: 'Indicação' },
  { code: 'organic', label: 'Orgânico' },
  { code: 'meta', label: 'Meta' },
  { code: 'google', label: 'Google' },
] as const;

export type ClientSource = (typeof CLIENT_SOURCES)[number]['code'];

export const CLIENT_SOURCE_CODES = CLIENT_SOURCES.map((s) => s.code) as ClientSource[];

export const CLIENT_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CLIENT_SOURCES.map((s) => [s.code, s.label])
);

// Rótulo para qualquer valor, incluindo cliente sem origem definida.
export function sourceLabel(code?: string | null): string {
  if (!code) return 'Não informado';
  return CLIENT_SOURCE_LABELS[code] ?? code;
}

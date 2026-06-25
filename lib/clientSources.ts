// Origem (canal de aquisição) do cliente.
// Código estável no banco + rótulo exibido na interface.

export const CLIENT_SOURCES = [
  { code: 'referral', label: 'Indicação', color: '#a855f7' },
  { code: 'organic', label: 'Orgânico', color: '#22c55e' },
  { code: 'meta', label: 'Meta', color: '#3b82f6' },
  { code: 'google', label: 'Google', color: '#eab308' },
] as const;

export const NONE_LABEL = 'Não informado';
export const NONE_COLOR = '#71717a';

export type ClientSource = (typeof CLIENT_SOURCES)[number]['code'];

export const CLIENT_SOURCE_CODES = CLIENT_SOURCES.map((s) => s.code) as ClientSource[];

export const CLIENT_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CLIENT_SOURCES.map((s) => [s.code, s.label])
);

// Rótulo para qualquer valor, incluindo cliente sem origem definida.
export function sourceLabel(code?: string | null): string {
  if (!code) return NONE_LABEL;
  return CLIENT_SOURCE_LABELS[code] ?? code;
}

const CLIENT_SOURCE_COLORS: Record<string, string> = Object.fromEntries(
  CLIENT_SOURCES.map((s) => [s.code, s.color])
);

// Cor para qualquer valor, incluindo cliente sem origem definida.
export function sourceColor(code?: string | null): string {
  if (!code) return NONE_COLOR;
  return CLIENT_SOURCE_COLORS[code] ?? NONE_COLOR;
}

// Período das telas financeiras: uma fonte só para "que intervalo estou vendo",
// "que dia é hoje" e "com o que eu comparo".
//
// Antes cada tela resolvia isso do seu jeito. O dashboard, o fluxo de caixa e o
// relatório do agente tinham três cópias da mesma regra de intervalo padrão, e
// duas noções diferentes de hoje: algumas contas usavam a data em UTC, o que na
// Vercel faz o dia virar às 21h no horário do Brasil, e no último dia do mês faz
// o mês virar junto.

// Brasil não tem horário de verão desde 2019, então o deslocamento fixo de 3
// horas é suficiente e não depende de tabela de fuso.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayBrt(): string {
  return new Date(Date.now() - BRT_OFFSET_MS).toISOString().split('T')[0]!;
}

// Componentes de ano, mês (1 a 12) e dia de uma data ISO, sem passar por Date.
function partsOf(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function startOfMonth(iso: string): string {
  const { year, month } = partsOf(iso);
  return `${year}-${pad(month)}-01`;
}

export function endOfMonth(iso: string): string {
  const { year, month } = partsOf(iso);
  return `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

// Diferença em dias, contando os dois extremos: 01/08 até 31/08 são 31 dias.
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

// O intervalo cobre exatamente um mês inteiro do calendário?
export function isFullCalendarMonth(from: string, to: string): boolean {
  return from === startOfMonth(from) && to === endOfMonth(from) && startOfMonth(from) === startOfMonth(to);
}

export type Period = { from: string; to: string };

// Intervalo que a tela está mostrando. Aceita ?from&to, mantém compatibilidade
// com os links antigos de ?month&year e, sem nada, devolve o mês corrente.
export function resolvePeriod(params: {
  from?: string;
  to?: string;
  month?: string;
  year?: string;
}): Period {
  if (params.from && params.to) return { from: params.from, to: params.to };

  if (params.month && params.year) {
    const m = Number(params.month);
    const y = Number(params.year);
    if (Number.isFinite(m) && Number.isFinite(y)) {
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` };
    }
  }

  const hoje = todayBrt();
  return { from: startOfMonth(hoje), to: endOfMonth(hoje) };
}

// Com o que este período se compara.
//
// Mês inteiro compara com o mês inteiro anterior, que é o que a pessoa espera ao
// navegar de agosto para julho, e não sofre com a diferença de tamanho entre
// fevereiro e março. Qualquer outro intervalo compara com o intervalo de mesma
// duração colado antes dele: 7 dias contra 7 dias, nunca 7 dias contra um mês.
export function previousPeriod({ from, to }: Period): Period {
  if (isFullCalendarMonth(from, to)) {
    const { year, month } = partsOf(from);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      from: `${prevYear}-${pad(prevMonth)}-01`,
      to: `${prevYear}-${pad(prevMonth)}-${pad(lastDayOfMonth(prevYear, prevMonth))}`,
    };
  }

  const duracao = daysBetween(from, to);
  const prevTo = addDaysIso(from, -1);
  return { from: addDaysIso(prevTo, -(duracao - 1)), to: prevTo };
}

export function formatPeriodLabel({ from, to }: Period): string {
  const f = partsOf(from);
  const t = partsOf(to);
  return `${pad(f.day)}/${pad(f.month)} a ${pad(t.day)}/${pad(t.month)}`;
}

// Variação percentual entre dois números, para os cards de comparação.
// Devolve null quando não há base de comparação: sair de zero para qualquer
// coisa é crescimento infinito, e mostrar "+∞%" ou "+100%" seria inventar.
export function percentChange(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

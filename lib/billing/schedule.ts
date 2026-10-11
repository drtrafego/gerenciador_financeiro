// Calendário da cobrança automática: módulo puro, sem banco e sem side effect.
//
// Regras que este arquivo materializa:
// 1. A data de VENCIMENTO (trigger_date) é canônica e nunca muda. O que muda é
//    a data de ENVIO, calculada por sendDateFor.
// 2. Finais de semana e feriados nacionais/bancários adiam o envio para o
//    próximo dia útil.
// 3. Entre duas mensagens consecutivas do mesmo vencimento (aviso -> D+2 -> D+5)
//    tem que existir pelo menos 2 dias úteis de intervalo, sempre contando a
//    partir da data EFETIVA de envio da mensagem anterior, não da nominal.
//    Sem isso, um vencimento no sábado empurraria o aviso para segunda e o D+2
//    nominal também cairia na segunda: o cliente receberia o aviso e a cobrança
//    de atraso no mesmo dia.
//
// Toda data circula como string 'YYYY-MM-DD' e é ancorada em meio-dia UTC
// (new Date(iso + 'T12:00:00Z')) para nunca dar off-by-one por fuso.

import type { ReminderStage } from '@/lib/db/schema';

// Etapas de cobrança de atraso, na ordem em que são disparadas.
export const DUNNING_STAGES = ['overdue_d2', 'overdue_d5'] as const;

// Intervalo mínimo, em dias úteis, entre os envios efetivos de duas mensagens
// consecutivas do mesmo vencimento (aviso -> D+2 e D+2 -> D+5).
const MIN_BUSINESS_DAYS_BETWEEN_MESSAGES = 2;

// Janela de varredura para trás em dueDateCandidatesFor. O maior atraso possível
// entre vencimento e envio hoje é de 7 dias (D+5 nominal caindo no sábado, mais
// o empurrão do intervalo mínimo). 14 dias dá folga de sobra sem custo.
const CANDIDATE_SCAN_DAYS = 14;

export function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

// 0 = domingo, 6 = sábado.
export function weekdayOf(iso: string): number {
  return parseIso(iso).getUTCDay();
}

// Finais de semana e feriados nacionais/bancários adiam o envio.
// Os feriados são calculados dinamicamente sem depender de tabela estática.
export function isWeekend(iso: string): boolean {
  const day = weekdayOf(iso);
  return day === 0 || day === 6;
}

// Algoritmo de Meeus/Jones/Butcher para a data da Páscoa no calendário gregoriano.
// Retorna a data no formato 'YYYY-MM-DD'.
export function getEasterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

const holidayCache = new Map<number, Set<string>>();

// Feriados nacionais oficiais (Lei 10.607/2002, Lei 6.802/1980, Lei 14.759/2023)
// e feriados bancários FEBRABAN / Resolução CMN 4.880.
export function getHolidaysForYear(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = getEasterSunday(year);
  const holidays = new Set<string>([
    // Feriados nacionais fixos
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalhador
    `${year}-09-07`, // Independência do Brasil
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Dia da Consciência Negra (Lei 14.759/2023)
    `${year}-12-25`, // Natal

    // Feriados móveis e bancários derivados da Páscoa
    addDays(easter, -48), // Segunda-feira de Carnaval
    addDays(easter, -47), // Terça-feira de Carnaval
    addDays(easter, -2),  // Sexta-feira Santa (Paixão de Cristo)
    addDays(easter, 60),  // Corpus Christi
  ]);

  holidayCache.set(year, holidays);
  return holidays;
}

export function isHoliday(iso: string): boolean {
  const yyyy = Number(iso.slice(0, 4));
  if (!yyyy || Number.isNaN(yyyy)) return false;
  return getHolidaysForYear(yyyy).has(iso);
}

// Dia útil: nem fim de semana nem feriado nacional/bancário.
export function isBusinessDay(iso: string): boolean {
  return !isWeekend(iso) && !isHoliday(iso);
}

// Motivo pelo qual um envio precisou ser adiado (para exibição natural na mensagem).
export type PostponeReason = 'fim de semana' | 'feriado' | 'fim de semana ou feriado';

export function getPostponedReason(iso: string): PostponeReason {
  const weekend = isWeekend(iso);
  const holiday = isHoliday(iso);
  if (weekend && holiday) return 'fim de semana ou feriado';
  if (holiday) return 'feriado';
  return 'fim de semana';
}

// Avança para o próximo dia útil caso a data caia em fim de semana ou feriado.
export function nextBusinessDay(iso: string): string {
  let current = iso;
  while (!isBusinessDay(current)) current = addDays(current, 1);
  return current;
}

// Avança N dias úteis a partir de uma data (a data de partida não é contada).
function addBusinessDays(iso: string, days: number): string {
  let current = iso;
  for (let i = 0; i < days; i++) current = nextBusinessDay(addDays(current, 1));
  return current;
}

export function lastDayOfMonthOf(iso: string): number {
  const d = parseIso(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

// Data de vencimento canônica do mês de "iso" para um contrato com aquele
// billingDay. billingDay 31 em fevereiro vira o dia 28 (ou 29 em ano bissexto).
export function canonicalDueDateFor(iso: string, billingDay: number | null | undefined): string {
  const d = parseIso(iso);
  const bd = billingDay ?? 5;
  const effectiveDay = Math.min(bd, lastDayOfMonthOf(iso));
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-${String(effectiveDay).padStart(2, '0')}`;
}

// Primeiro vencimento de um contrato: o vencimento canônico mais antigo que não
// é anterior à data de início. Contrato que começa depois do dia de cobrança do
// mês só vence no mês seguinte (assinou dia 19 com billingDay 15 => vence 15 do
// mês que vem).
//
// A virada de mês passa pelo DIA 1 de propósito. Somar um mês em cima da data
// candidata quebraria com billingDay alto: 31/01 mais um mês vira 03/03 no
// calendário do JavaScript, e o vencimento sairia no mês errado.
export function firstDueDateFor(startDateIso: string, billingDay: number | null | undefined): string {
  const candidate = canonicalDueDateFor(startDateIso, billingDay);
  if (candidate >= startDateIso) return candidate;

  const d = parseIso(startDateIso);
  const nextMonthFirst = toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12)));
  return canonicalDueDateFor(nextMonthFirst, billingDay);
}

// Aquele vencimento é a PRIMEIRA parcela do contrato? Usado só para escolher o
// texto da mensagem; não muda nenhuma etapa nem chave de deduplicação.
export function isFirstBillingFor(
  dueIso: string,
  startDateIso: string | null | undefined,
  billingDay: number | null | undefined
): boolean {
  if (!startDateIso) return false;
  return firstDueDateFor(startDateIso, billingDay) === dueIso;
}

// Data em que a mensagem daquela etapa deve sair de fato.
export function sendDateFor(dueIso: string, stage: ReminderStage): string {
  if (stage === 'due') return nextBusinessDay(dueIso);

  if (stage === 'overdue_d2') {
    // D+2: além de cair em dia útil, respeita o intervalo mínimo contado a
    // partir do envio EFETIVO do aviso (que pode ter sido adiado pelo fim de semana).
    const nominal = nextBusinessDay(addDays(dueIso, 2));
    const minimum = addBusinessDays(sendDateFor(dueIso, 'due'), MIN_BUSINESS_DAYS_BETWEEN_MESSAGES);
    return nominal > minimum ? nominal : minimum;
  }

  // D+5: mesma lógica, contada a partir do envio EFETIVO do D+2.
  const nominal = nextBusinessDay(addDays(dueIso, 5));
  const minimum = addBusinessDays(sendDateFor(dueIso, 'overdue_d2'), MIN_BUSINESS_DAYS_BETWEEN_MESSAGES);
  return nominal > minimum ? nominal : minimum;
}

// Inverso de sendDateFor: quais datas de vencimento têm envio daquela etapa
// marcado para hoje. Devolve lista vazia em finais de semana e feriados,
// porque nenhum envio é agendado fora de dia útil.
export function dueDateCandidatesFor(todayIso: string, stage: ReminderStage): string[] {
  if (!isBusinessDay(todayIso)) return [];

  const candidates: string[] = [];
  for (let offset = 0; offset <= CANDIDATE_SCAN_DAYS; offset++) {
    const dueIso = addDays(todayIso, -offset);
    if (sendDateFor(dueIso, stage) === todayIso) candidates.push(dueIso);
  }
  return candidates;
}

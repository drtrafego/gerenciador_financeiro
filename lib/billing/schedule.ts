// Calendário da cobrança automática: módulo puro, sem banco e sem side effect.
//
// Regras que este arquivo materializa:
// 1. A data de VENCIMENTO (trigger_date) é canônica e nunca muda. O que muda é
//    a data de ENVIO, calculada por sendDateFor.
// 2. Só sábado e domingo adiam o envio para o próximo dia útil.
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

// Só sábado e domingo adiam o envio. Feriado nacional NÃO adia, por decisão do
// dono: manter uma tabela de feriados desatualizada seria pior do que enviar a
// mensagem no feriado, que é lida do mesmo jeito.
export function isWeekend(iso: string): boolean {
  const day = weekdayOf(iso);
  return day === 0 || day === 6;
}

export function nextBusinessDay(iso: string): string {
  let current = iso;
  while (isWeekend(current)) current = addDays(current, 1);
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
// marcado para hoje. Devolve lista vazia em sábado e domingo, porque nenhum
// envio é agendado para o fim de semana.
export function dueDateCandidatesFor(todayIso: string, stage: ReminderStage): string[] {
  if (isWeekend(todayIso)) return [];

  const candidates: string[] = [];
  for (let offset = 0; offset <= CANDIDATE_SCAN_DAYS; offset++) {
    const dueIso = addDays(todayIso, -offset);
    if (sendDateFor(dueIso, stage) === todayIso) candidates.push(dueIso);
  }
  return candidates;
}

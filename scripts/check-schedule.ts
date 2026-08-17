// Conferência manual do calendário de cobrança (lib/billing/schedule.ts).
// Não toca no banco, não envia nada: só imprime os casos de borda para leitura.
// Rodar com: npx tsx scripts/check-schedule.ts

import {
  canonicalDueDateFor,
  dueDateCandidatesFor,
  sendDateFor,
  weekdayOf,
} from '../lib/billing/schedule';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function diaDaSemana(iso: string) {
  return DIAS[weekdayOf(iso)]!;
}

function linhaDeVencimento(dueIso: string) {
  const due = sendDateFor(dueIso, 'due');
  const d2 = sendDateFor(dueIso, 'overdue_d2');
  const d5 = sendDateFor(dueIso, 'overdue_d5');
  console.log(
    `vencimento ${dueIso} (${diaDaSemana(dueIso)}) -> ` +
      `aviso ${due} (${diaDaSemana(due)}), ` +
      `D+2 ${d2} (${diaDaSemana(d2)}), ` +
      `D+5 ${d5} (${diaDaSemana(d5)})`
  );
}

console.log('== Vencimento em cada dia da semana (semana de 2026-08-10, segunda) ==');
for (const dueIso of [
  '2026-08-10',
  '2026-08-11',
  '2026-08-12',
  '2026-08-13',
  '2026-08-14',
  '2026-08-15',
  '2026-08-16',
]) {
  linhaDeVencimento(dueIso);
}

console.log('\n== Virada de mês e fevereiro ==');
for (const dueIso of ['2026-01-31', '2026-02-27', '2026-02-28', '2024-02-29', '2026-12-31']) {
  linhaDeVencimento(dueIso);
}

console.log('\n== canonicalDueDateFor com billingDay 31 ==');
for (const [iso, billingDay] of [
  ['2026-02-10', 31],
  ['2024-02-10', 31],
  ['2026-04-10', 31],
  ['2026-01-10', 31],
  ['2026-02-10', 5],
] as const) {
  console.log(`mês de ${iso}, billingDay ${billingDay} -> ${canonicalDueDateFor(iso, billingDay)}`);
}

console.log('\n== dueDateCandidatesFor, dia a dia de 2026-08-08 a 2026-08-21 ==');
for (let d = 8; d <= 21; d++) {
  const todayIso = `2026-08-${String(d).padStart(2, '0')}`;
  const due = dueDateCandidatesFor(todayIso, 'due');
  const d2 = dueDateCandidatesFor(todayIso, 'overdue_d2');
  const d5 = dueDateCandidatesFor(todayIso, 'overdue_d5');
  console.log(
    `${todayIso} (${diaDaSemana(todayIso)}): aviso [${due.join(', ')}] | ` +
      `D+2 [${d2.join(', ')}] | D+5 [${d5.join(', ')}]`
  );
}

console.log('\n== Espaçamento mínimo: dias úteis entre o envio do D+2 e o do D+5 ==');
for (const dueIso of [
  '2026-08-10',
  '2026-08-11',
  '2026-08-12',
  '2026-08-13',
  '2026-08-14',
  '2026-08-15',
  '2026-08-16',
]) {
  const d2 = sendDateFor(dueIso, 'overdue_d2');
  const d5 = sendDateFor(dueIso, 'overdue_d5');
  let uteis = 0;
  const cursor = new Date(`${d2}T12:00:00Z`);
  while (cursor.toISOString().split('T')[0]! < d5) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const iso = cursor.toISOString().split('T')[0]!;
    const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
    if (dia !== 0 && dia !== 6) uteis++;
  }
  console.log(`vencimento ${dueIso} (${diaDaSemana(dueIso)}): ${d2} -> ${d5} = ${uteis} dia(s) útil(eis)`);
}

// Status efetivo do contrato.
// "Finalizado" é DERIVADO da data de término (não é gravado no banco): quando a
// data de término já passou e o contrato não foi cancelado/pausado, ele é tratado
// como finalizado e deixa de contar como receita recorrente (MRR / receita por canal).
// "Cancelado" continua sendo uma ação manual (interrupção antes do prazo).

export type EffectiveContractStatus = 'active' | 'paused' | 'cancelled' | 'finished';

export const CONTRACT_STATUS_LABELS: Record<EffectiveContractStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  finished: 'Finalizado',
};

export const CONTRACT_STATUS_STYLES: Record<EffectiveContractStatus, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  finished: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function effectiveContractStatus(
  status: string | null | undefined,
  endDate: string | null | undefined
): EffectiveContractStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'paused') return 'paused';
  if (endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate + 'T00:00:00');
    if (end < today) return 'finished';
  }
  return 'active';
}

// Conta como receita recorrente viva? (ativo e dentro do prazo)
export function isContractEarning(
  status: string | null | undefined,
  endDate: string | null | undefined
): boolean {
  return effectiveContractStatus(status, endDate) === 'active';
}

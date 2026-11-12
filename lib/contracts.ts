// Status efetivo do contrato.
// "Finalizado" é DERIVADO da data de término exclusivamente para projetos pontuais
// (type === 'project'). Contratos de mensalidade e fee fixo recorrente (fixed_fee,
// fixed_plus_percentage) com status 'active' têm RENOVAÇÃO AUTOMÁTICA: se não foram
// cancelados ou pausados pelo dono, continuam ativos indefinidamente.
// "Cancelado" continua sendo uma ação manual (interrupção do contrato).

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
  endDate: string | null | undefined,
  fixedTerm?: boolean
): EffectiveContractStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'paused') return 'paused';
  // Apenas projetos pontuais (não recorrentes) são finalizados pela data de término.
  // Contratos mensais ativos contam com renovação automática contínua.
  if (fixedTerm && endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate + 'T00:00:00');
    if (end < today) return 'finished';
  }
  return 'active';
}

// Conta como receita recorrente viva? (ativo e dentro do prazo / renovado)
export function isContractEarning(
  status: string | null | undefined,
  endDate: string | null | undefined,
  fixedTerm?: boolean
): boolean {
  return effectiveContractStatus(status, endDate, fixedTerm) === 'active';
}

// Contrato com prazo fechado: projeto pontual ou mensalidade com renovação automática desligada.
export function isFixedTerm(type: string | null | undefined, autoRenew: boolean | null | undefined): boolean {
  return type === 'project' || autoRenew === false;
}

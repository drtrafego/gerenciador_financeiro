import { getDashboardData, getCashFlowData, getOverdueReport, getLatestExchangeRate } from '@/lib/db/queries';
import { resolvePeriod as resolvePeriodParams } from '@/lib/period';

// Mesmo padrão de período das páginas humanas, agora vindo do mesmo lugar
// (lib/period.ts): mês atual inteiro quando from/to não são informados, com o
// mês calculado no horário do Brasil.
function resolvePeriod(from?: string | null, to?: string | null) {
  return resolvePeriodParams({ from: from ?? undefined, to: to ?? undefined });
}

// Fonte única com o dashboard humano (lib/db/queries.ts getDashboardData): os
// números do Telegram têm que bater com o painel.
export async function getDashboardMetricsService(fromParam?: string | null, toParam?: string | null) {
  const { from, to } = resolvePeriod(fromParam, toParam);
  const data = await getDashboardData(from, to);
  return { from, to, ...data };
}

export async function getCashFlowService(fromParam?: string | null, toParam?: string | null) {
  const { from, to } = resolvePeriod(fromParam, toParam);
  const data = await getCashFlowData(from, to);
  return { from, to, ...data };
}

export async function getOverdueReportService() {
  return getOverdueReport();
}

export async function getLatestExchangeRateService() {
  const rate = await getLatestExchangeRate();
  if (!rate) return null;
  return rate;
}

import { getDashboardData, getCashFlowData, getOverdueReport, getLatestExchangeRate } from '@/lib/db/queries';

const iso = (d: Date) => d.toISOString().split('T')[0]!;

// Mesmo padrão de período usado pelas páginas humanas: mês atual inteiro se
// from/to não forem informados.
function resolvePeriod(from?: string | null, to?: string | null) {
  if (from && to) return { from, to };
  const now = new Date();
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
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

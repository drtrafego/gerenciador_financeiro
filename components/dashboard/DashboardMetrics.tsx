"use client";

import MetricCard from "@/components/dashboard/MetricCard";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import type { Currency, RatesMap } from "@/lib/currency/format";

interface Props {
  mrr: number;
  monthExpense: number;
  activeClients: number;
  overdueClients: number;
  overdueInvoicesCount: number;
  displayCurrency: Currency;
  rate: RatesMap;
}

export default function DashboardMetrics({
  mrr,
  monthExpense,
  activeClients,
  overdueClients,
  overdueInvoicesCount,
  displayCurrency,
  rate,
}: Props) {
  const { hidden } = useValuesVisibility();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        label="MRR"
        value={mrr}
        currency={displayCurrency}
        rate={rate}
        sub={`${activeClients} clientes ativos`}
        icon="trending-up"
        color="indigo"
        hidden={hidden}
        delayMs={0}
      />
      <MetricCard
        label="Receita Prevista"
        value={mrr}
        currency={displayCurrency}
        rate={rate}
        sub="contratos ativos este mês"
        icon="check"
        color="green"
        hidden={hidden}
        delayMs={60}
      />
      <MetricCard
        label="Despesas (mês)"
        value={monthExpense}
        currency={displayCurrency}
        rate={rate}
        sub="saídas no mês"
        icon="trending-down"
        color="red"
        hidden={hidden}
        delayMs={120}
      />
      <MetricCard
        label="Inadimplentes"
        value={overdueClients}
        raw
        sub={`${overdueInvoicesCount} fatura(s) em atraso`}
        icon="alert"
        color="yellow"
        delayMs={180}
      />
    </div>
  );
}

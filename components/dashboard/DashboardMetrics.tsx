"use client";

import MetricCard from "@/components/dashboard/MetricCard";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";
import { percentChange } from "@/lib/period";
import type { Currency, RatesMap } from "@/lib/currency/format";

// Duas linhas de indicadores, cada uma respondendo uma pergunta diferente:
//
// "caixa"   : quanto entrou, quanto falta entrar e quanto saiu no período.
// "negocio" : quanto está contratado, quantos clientes sustentam isso e o que
//             está vencido.
//
// Todos os cards com valor comparável mostram a variação contra o período
// anterior, que é o que responde "estou melhorando de um mês para o outro".
//
// Atenção ao passar valores: os totais do período (recebido, a receber, pago,
// saldo, em atraso) já chegam convertidos para a moeda de exibição, por isso
// levam `sourceCurrency={displayCurrency}`, senão o MetricCard converteria de
// novo tratando o valor como se fosse real. Já MRR e ticket médio chegam em
// reais e usam o padrão do card, que é converter a partir de BRL.

type Previous = {
  received: number;
  toReceive: number;
  expense: number;
  income: number;
  balance: number;
  mrr: number;
};

interface Props {
  variant?: "caixa" | "negocio";
  previous: Previous;
  comparadoCom: string;
  displayCurrency: Currency;
  rate: RatesMap;

  // variante caixa
  received?: number;
  toReceive?: number;
  expense?: number;
  balance?: number;

  // variante negócio
  mrr?: number;
  activeClients?: number;
  contratosNovos?: number;
  contratosEncerrados?: number;
  overdueClients?: number;
  overdueAmount?: number;
  overdueInvoicesCount?: number;
}

// Arredonda para uma casa e devolve undefined quando não há base de comparação,
// que é o que faz o MetricCard esconder a tarja em vez de mostrar "0%".
function trendOf(atual: number, anterior: number): number | undefined {
  const variacao = percentChange(atual, anterior);
  return variacao === null ? undefined : Math.round(variacao * 10) / 10;
}

export default function DashboardMetrics({
  variant = "caixa",
  previous,
  comparadoCom,
  displayCurrency,
  rate,
  received = 0,
  toReceive = 0,
  expense = 0,
  balance = 0,
  mrr = 0,
  activeClients = 0,
  contratosNovos = 0,
  contratosEncerrados = 0,
  overdueClients = 0,
  overdueAmount = 0,
  overdueInvoicesCount = 0,
}: Props) {
  const { hidden } = useValuesVisibility();

  if (variant === "negocio") {
    const saldoContratos = contratosNovos - contratosEncerrados;
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="MRR"
          value={mrr}
          currency={displayCurrency}
          rate={rate}
          sub={`${activeClients} cliente(s) com contrato ativo`}
          icon="trending-up"
          color="indigo"
          hidden={hidden}
          trend={trendOf(mrr, previous.mrr)}
          trendLabel={comparadoCom}
          delayMs={0}
        />
        <MetricCard
          label="Ticket médio"
          value={activeClients > 0 ? mrr / activeClients : 0}
          currency={displayCurrency}
          rate={rate}
          sub="MRR por cliente ativo"
          icon="bar-chart"
          color="indigo"
          hidden={hidden}
          delayMs={60}
        />
        <MetricCard
          label="Contratos no período"
          value={saldoContratos}
          raw
          sub={`${contratosNovos} novo(s), ${contratosEncerrados} encerrado(s)`}
          icon="check"
          color={saldoContratos >= 0 ? "green" : "red"}
          delayMs={120}
        />
        <MetricCard
          label="Em atraso"
          value={overdueAmount}
          currency={displayCurrency}
          sourceCurrency={displayCurrency}
          rate={rate}
          sub={`${overdueInvoicesCount} fatura(s), ${overdueClients} cliente(s)`}
          icon="alert"
          color="yellow"
          hidden={hidden}
          delayMs={180}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        label="Recebido"
        value={received}
        currency={displayCurrency}
        sourceCurrency={displayCurrency}
        rate={rate}
        sub="entrou no período"
        icon="check"
        color="green"
        hidden={hidden}
        trend={trendOf(received, previous.received)}
        trendLabel={comparadoCom}
        delayMs={0}
      />
      <MetricCard
        label="A receber"
        value={toReceive}
        currency={displayCurrency}
        sourceCurrency={displayCurrency}
        rate={rate}
        sub="ainda em aberto no período"
        icon="dollar"
        color="yellow"
        hidden={hidden}
        trend={trendOf(toReceive, previous.toReceive)}
        trendLabel={comparadoCom}
        delayMs={60}
      />
      <MetricCard
        label="Pago"
        value={expense}
        currency={displayCurrency}
        sourceCurrency={displayCurrency}
        rate={rate}
        sub="saídas no período"
        icon="trending-down"
        color="red"
        hidden={hidden}
        trend={trendOf(expense, previous.expense)}
        trendLabel={comparadoCom}
        delayMs={120}
      />
      <MetricCard
        label="Saldo"
        value={balance}
        currency={displayCurrency}
        sourceCurrency={displayCurrency}
        rate={rate}
        sub="recebido menos pago"
        icon="bar-chart"
        color={balance >= 0 ? "indigo" : "red"}
        hidden={hidden}
        trend={trendOf(balance, previous.balance)}
        trendLabel={comparadoCom}
        delayMs={180}
      />
    </div>
  );
}

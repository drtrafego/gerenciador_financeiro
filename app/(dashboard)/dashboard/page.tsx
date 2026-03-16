export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { invoices, transactions, clients, contracts, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, gte, and, sql } from "drizzle-orm";
import { convertAmount, safeRates } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import MetricCard from "@/components/dashboard/MetricCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MRRChart from "@/components/dashboard/MRRChart";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import AlertsPanel from "@/components/dashboard/AlertsPanel";

async function getDashboardData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]!;
  const today = now.toISOString().split("T")[0]!;
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0]!;

  // Data de início da janela de 6 meses
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    activeClients,
    overdueClients,
    latestRate,
    displayCurrencySetting,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    monthExpense,
    allContracts,
    expenseTransactions,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.status, "overdue")),
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
    db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(5),
    db.select().from(invoices).where(eq(invoices.status, "overdue")),
    db.select().from(invoices).where(
      and(eq(invoices.status, "sent"), sql`due_date BETWEEN ${today} AND ${in7days}`)
    ),
    db.select({ total: sql<number>`coalesce(sum(amount),0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "expense"), gte(transactions.date, startOfMonth))),
    // Todos os contratos para calcular receita mensal
    db.select({
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      status: contracts.status,
    }).from(contracts),
    // Transações de despesa dos últimos 6 meses (agrupamos em JS para evitar mismatch de locale)
    db.select({ amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .where(and(eq(transactions.type, "expense"), gte(transactions.date, sixMonthsAgo.toISOString().split("T")[0]!))),
  ]);

  const rateRow = latestRate[0];
  const rate = safeRates(
    rateRow ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) } : null
  );
  const displayCurrency = (displayCurrencySetting[0]?.value ?? "BRL") as Currency;

  // MRR = soma dos contratos ativos, todos convertidos para BRL
  // O MetricCard recebe em BRL e converte para a moeda de exibição (sourceCurrency padrão = "BRL")
  const activeContracts = allContracts.filter((c) => c.status === "active");
  const mrr = activeContracts.reduce((sum, c) => {
    const amount = parseFloat(c.fixedAmount ?? "0");
    return sum + convertAmount(amount, (c.currency ?? "BRL") as Currency, "BRL", rate);
  }, 0);

  // Agrupar despesas por "YYYY-MM" em JS (evita mismatch de locale com SQL)
  const expenseMap = new Map<string, number>();
  for (const t of expenseTransactions) {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + parseFloat(t.amount ?? "0"));
  }

  // Gerar dados do gráfico para os últimos 6 meses
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const monthIncome = allContracts
      .filter((c) => {
        const start = new Date(c.startDate + "T12:00:00");
        const end = c.endDate ? new Date(c.endDate + "T12:00:00") : null;
        return start <= monthEnd && (end === null || end >= monthStart);
      })
      .reduce((sum, c) => {
        const amount = parseFloat(c.fixedAmount ?? "0");
        return sum + convertAmount(amount, (c.currency ?? "BRL") as Currency, "BRL", rate);
      }, 0);

    chartData.push({
      month: label,
      income: monthIncome,
      expense: expenseMap.get(key) ?? 0,
    });
  }

  return {
    activeClients: Number(activeClients[0]?.count ?? 0),
    overdueClients: Number(overdueClients[0]?.count ?? 0),
    rate,
    displayCurrency,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    mrr,
    monthExpense: Number(monthExpense[0]?.total ?? 0),
    chartData,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="MRR"
          value={data.mrr}
          currency={data.displayCurrency}
          rate={data.rate}
          sub={`${data.activeClients} clientes ativos`}
          icon="trending-up"
          color="indigo"
        />
        <MetricCard
          label="Receita Prevista"
          value={data.mrr}
          currency={data.displayCurrency}
          rate={data.rate}
          sub="contratos ativos este mês"
          icon="check"
          color="green"
        />
        <MetricCard
          label="Despesas (mês)"
          value={data.monthExpense}
          currency={data.displayCurrency}
          rate={data.rate}
          sub="saídas no mês"
          icon="trending-down"
          color="red"
        />
        <MetricCard
          label="Inadimplentes"
          value={data.overdueClients}
          raw
          sub={`${data.overdueInvoices.length} fatura(s) em atraso`}
          icon="alert"
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart data={data.chartData} />
        <MRRChart data={data.chartData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentInvoices invoices={data.recentInvoices} />
        <AlertsPanel overdue={data.overdueInvoices} upcoming={data.upcomingInvoices} />
      </div>
    </div>
  );
}

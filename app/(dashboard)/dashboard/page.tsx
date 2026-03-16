export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { invoices, transactions, clients, contracts, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, gte, and, sql } from "drizzle-orm";
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
    expensesByMonth,
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
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      status: contracts.status,
    }).from(contracts),
    // Despesas por mês para o gráfico
    db.execute(sql`
      SELECT to_char(date_trunc('month', date::date), 'Mon/YY') as month,
             date_trunc('month', date::date) as month_start,
             sum(amount) as expense
      FROM transactions
      WHERE type = 'expense' AND date >= ${sixMonthsAgo.toISOString().split("T")[0]}
      GROUP BY date_trunc('month', date::date)
      ORDER BY date_trunc('month', date::date)
    `),
  ]);

  const rateRow = latestRate[0];
  const rate = rateRow
    ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) }
    : { usd_brl: 5.87, usd_ars: 1429 };

  // MRR atual = soma dos contratos ativos
  const activeContracts = allContracts.filter((c) => c.status === "active");
  const mrr = activeContracts.reduce((sum, c) => sum + parseFloat(c.fixedAmount ?? "0"), 0);

  // Gerar dados do gráfico para os últimos 6 meses
  // Receita = contratos que estavam ativos naquele mês
  const expenseMap = new Map<string, number>();
  for (const row of Array.from(expensesByMonth)) {
    expenseMap.set(String((row as any).month), Number((row as any).expense ?? 0));
  }

  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); // último dia do mês
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    // Receita = contratos que estavam vigentes neste mês
    const monthIncome = allContracts
      .filter((c) => {
        const start = new Date(c.startDate + "T12:00:00");
        const end = c.endDate ? new Date(c.endDate + "T12:00:00") : null;
        const wasActive = start <= monthEnd && (end === null || end >= monthStart);
        // Incluir contratos ativos ou que foram cancelados/pausados após iniciarem
        return wasActive;
      })
      .reduce((sum, c) => sum + parseFloat(c.fixedAmount ?? "0"), 0);

    const expenseKey = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const monthExpenseVal = expenseMap.get(expenseKey) ?? 0;

    chartData.push({
      month: label,
      income: monthIncome,
      expense: monthExpenseVal,
    });
  }

  return {
    activeClients: Number(activeClients[0]?.count ?? 0),
    overdueClients: Number(overdueClients[0]?.count ?? 0),
    rate,
    displayCurrency: (displayCurrencySetting[0]?.value ?? "BRL") as "BRL" | "USD" | "ARS",
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

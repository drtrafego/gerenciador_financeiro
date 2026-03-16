import { db } from "@/lib/db";
import { invoices, transactions, clients, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, gte, and, sql } from "drizzle-orm";
import MetricCard from "@/components/dashboard/MetricCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MRRChart from "@/components/dashboard/MRRChart";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import AlertsPanel from "@/components/dashboard/AlertsPanel";

async function getDashboardData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

  const [
    activeClients,
    overdueClients,
    latestRate,
    displayCurrencySetting,
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    monthIncome,
    monthExpense,
    last6Months,
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
      .where(and(eq(transactions.type, "income"), gte(transactions.date, startOfMonth))),
    db.select({ total: sql<number>`coalesce(sum(amount),0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "expense"), gte(transactions.date, startOfMonth))),
    db.execute(sql`
      SELECT to_char(date_trunc('month', date), 'Mon') as month,
             sum(case when type='income' then amount else 0 end) as income,
             sum(case when type='expense' then amount else 0 end) as expense
      FROM transactions
      WHERE date >= now() - interval '6 months'
      GROUP BY date_trunc('month', date)
      ORDER BY date_trunc('month', date)
    `),
  ]);

  const rateRow = latestRate[0];
  const rate = rateRow
    ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) }
    : { usd_brl: 5.87, usd_ars: 1429 };

  return {
    activeClients: Number(activeClients[0]?.count ?? 0),
    overdueClients: Number(overdueClients[0]?.count ?? 0),
    rate,
    displayCurrency: (displayCurrencySetting[0]?.value ?? "BRL") as "BRL" | "USD" | "ARS",
    recentInvoices,
    overdueInvoices,
    upcomingInvoices,
    monthIncome: Number(monthIncome[0]?.total ?? 0),
    monthExpense: Number(monthExpense[0]?.total ?? 0),
    chartData: Array.from(last6Months) as any[],
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="MRR"
          value={data.monthIncome}
          currency={data.displayCurrency}
          rate={data.rate}
          sub={`${data.activeClients} clientes ativos`}
          icon="trending-up"
          color="indigo"
          trend={11.3}
        />
        <MetricCard
          label="Recebido (mês)"
          value={data.monthIncome}
          currency={data.displayCurrency}
          rate={data.rate}
          sub="entradas confirmadas"
          icon="check"
          color="green"
          trend={8.1}
        />
        <MetricCard
          label="Despesas (mês)"
          value={data.monthExpense}
          currency={data.displayCurrency}
          rate={data.rate}
          sub="saídas no mês"
          icon="trending-down"
          color="red"
          trend={-2.4}
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

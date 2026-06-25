export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { invoices, transactions, clients, contracts, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, gte, and, sql } from "drizzle-orm";
import { convertAmount, safeRates } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MRRChart from "@/components/dashboard/MRRChart";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import SourceBreakdown from "@/components/dashboard/SourceBreakdown";
import SourceMrrBar from "@/components/dashboard/SourceMrrBar";
import SourceMrrTrend from "@/components/dashboard/SourceMrrTrend";
import { CLIENT_SOURCES, NONE_LABEL, NONE_COLOR, sourceLabel } from "@/lib/clientSources";
import { isContractEarning } from "@/lib/contracts";

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
    sourceContracts,
    sourceIncome,
    clientSourceRows,
    contractsWithSource,
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
    // Origem do cliente: MRR (contratos ativos por canal; finalizados filtrados em JS)
    db.select({ source: clients.source, fixedAmount: contracts.fixedAmount, currency: contracts.currency, endDate: contracts.endDate })
      .from(contracts)
      .innerJoin(clients, eq(contracts.clientId, clients.id))
      .where(eq(contracts.status, "active")),
    // Origem do cliente: total já recebido (transações de receita por canal)
    db.select({ source: clients.source, amount: transactions.amount, currency: transactions.currency })
      .from(transactions)
      .innerJoin(clients, eq(transactions.clientId, clients.id))
      .where(eq(transactions.type, "income")),
    // Contagem de clientes por origem (todos os clientes cadastrados)
    db.select({ source: clients.source }).from(clients),
    // Todos os contratos com a origem do cliente, para a evolução do MRR por canal
    db.select({
      source: clients.source,
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
    }).from(contracts).leftJoin(clients, eq(contracts.clientId, clients.id)),
  ]);

  const rateRow = latestRate[0];
  const rate = safeRates(
    rateRow ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) } : null
  );
  const displayCurrency = (displayCurrencySetting[0]?.value ?? "BRL") as Currency;

  // MRR = soma dos contratos ativos, todos convertidos para BRL
  // O MetricCard recebe em BRL e converte para a moeda de exibição (sourceCurrency padrão = "BRL")
  const activeContracts = allContracts.filter((c) => isContractEarning(c.status, c.endDate));
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

  // ─── Receita por origem (canal de aquisição) ───
  // Códigos na ordem fixa de exibição; "none" = cliente sem origem definida.
  const SOURCE_ORDER = ["referral", "organic", "meta", "google"];
  const sourceAgg = new Map<string, { mrr: number; total: number; clients: number }>();
  const ensureSource = (key: string) => {
    let entry = sourceAgg.get(key);
    if (!entry) {
      entry = { mrr: 0, total: 0, clients: 0 };
      sourceAgg.set(key, entry);
    }
    return entry;
  };

  for (const r of sourceContracts) {
    if (!isContractEarning("active", r.endDate)) continue; // pula contratos finalizados
    const key = r.source ?? "none";
    ensureSource(key).mrr += convertAmount(parseFloat(r.fixedAmount ?? "0"), (r.currency ?? "BRL") as Currency, "BRL", rate);
  }
  for (const r of sourceIncome) {
    const key = r.source ?? "none";
    ensureSource(key).total += convertAmount(parseFloat(r.amount ?? "0"), (r.currency ?? "BRL") as Currency, "BRL", rate);
  }
  for (const r of clientSourceRows) {
    ensureSource(r.source ?? "none").clients += 1;
  }

  const sourceBreakdown = [...SOURCE_ORDER, "none"]
    .filter((key) => {
      if (key !== "none") return true;
      const e = sourceAgg.get("none");
      return !!e && (e.mrr > 0 || e.total > 0 || e.clients > 0);
    })
    .map((key) => {
      const e = sourceAgg.get(key);
      return { code: key, mrr: e?.mrr ?? 0, total: e?.total ?? 0, clients: e?.clients ?? 0 };
    });

  // Evolução do MRR por canal nos últimos 6 meses (mesmo critério de janela do RevenueChart).
  const sourceTrendData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    const row: Record<string, number | string> = { month: label };
    for (const s of CLIENT_SOURCES) row[s.label] = 0;
    row[NONE_LABEL] = 0;

    for (const c of contractsWithSource) {
      const start = new Date(c.startDate + "T12:00:00");
      const end = c.endDate ? new Date(c.endDate + "T12:00:00") : null;
      if (start <= monthEnd && (end === null || end >= monthStart)) {
        const amount = convertAmount(parseFloat(c.fixedAmount ?? "0"), (c.currency ?? "BRL") as Currency, "BRL", rate);
        const key = sourceLabel(c.source);
        row[key] = (Number(row[key]) || 0) + amount;
      }
    }
    sourceTrendData.push(row);
  }

  // Só desenha as linhas dos canais que têm algum valor na janela.
  const activeLabels = new Set<string>();
  for (const row of sourceTrendData) {
    for (const k of Object.keys(row)) {
      if (k !== "month" && Number(row[k]) > 0) activeLabels.add(k);
    }
  }
  const sourceSeries = [
    ...CLIENT_SOURCES.map((s) => ({ key: s.label, color: s.color })),
    { key: NONE_LABEL, color: NONE_COLOR },
  ].filter((s) => activeLabels.has(s.key));

  return {
    sourceBreakdown,
    sourceTrendData,
    sourceSeries,
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
      <DashboardMetrics
        mrr={data.mrr}
        monthExpense={data.monthExpense}
        activeClients={data.activeClients}
        overdueClients={data.overdueClients}
        overdueInvoicesCount={data.overdueInvoices.length}
        displayCurrency={data.displayCurrency}
        rate={data.rate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart data={data.chartData} />
        <MRRChart data={data.chartData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SourceMrrBar rows={data.sourceBreakdown} />
        <SourceMrrTrend data={data.sourceTrendData} series={data.sourceSeries} />
      </div>

      <SourceBreakdown
        rows={data.sourceBreakdown}
        displayCurrency={data.displayCurrency}
        rate={data.rate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentInvoices invoices={data.recentInvoices} />
        <AlertsPanel overdue={data.overdueInvoices} upcoming={data.upcomingInvoices} />
      </div>
    </div>
  );
}

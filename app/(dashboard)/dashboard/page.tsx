export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { invoices, transactions, clients, contracts, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, gte, lte, lt, or, isNull, and, sql, getTableColumns } from "drizzle-orm";
import { notTestClient } from "@/lib/db/filters";
import DateRangePicker from "@/components/shared/DateRangePicker";
import MaskedCurrency from "@/components/shared/MaskedCurrency";
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

async function getDashboardData(from: string, to: string) {
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
    clientSourceRows,
    contractsWithSource,
    periodRealTx,
    periodRecurringPast,
    periodContracts,
    sixMonthIncomeTx,
    sixMonthRecurringPast,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(clients).where(and(eq(clients.status, "active"), notTestClient)),
    db.select({ count: sql<number>`count(*)` }).from(clients).where(and(eq(clients.status, "overdue"), notTestClient)),
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(notTestClient)
      .orderBy(desc(invoices.createdAt)).limit(5),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, "overdue"), notTestClient)),
    db.select(getTableColumns(invoices))
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.status, "sent"), sql`due_date BETWEEN ${today} AND ${in7days}`, notTestClient)),
    db.select({ total: sql<number>`coalesce(sum(${transactions.amount}),0)` })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(eq(transactions.type, "expense"), gte(transactions.date, startOfMonth), notTestClient)),
    // Todos os contratos para calcular receita mensal
    db.select({
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      status: contracts.status,
      billingDay: contracts.billingDay,
    }).from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(notTestClient),
    // Transações de despesa dos últimos 6 meses (agrupamos em JS para evitar mismatch de locale)
    db.select({ amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(eq(transactions.type, "expense"), gte(transactions.date, sixMonthsAgo.toISOString().split("T")[0]!), notTestClient)),
    // Origem do cliente: MRR (contratos ativos por canal; finalizados filtrados em JS)
    db.select({ source: clients.source, fixedAmount: contracts.fixedAmount, currency: contracts.currency, endDate: contracts.endDate })
      .from(contracts)
      .innerJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(eq(contracts.status, "active"), notTestClient)),
    // Contagem de clientes por origem (todos os clientes cadastrados)
    db.select({ source: clients.source }).from(clients).where(notTestClient),
    // Todos os contratos com a origem do cliente, para a evolução do MRR por canal
    db.select({
      source: clients.source,
      fixedAmount: contracts.fixedAmount,
      currency: contracts.currency,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
    }).from(contracts).leftJoin(clients, eq(contracts.clientId, clients.id)).where(notTestClient),
    // Resumo do período (bate com o fluxo de caixa): transações reais no intervalo,
    // recorrentes anteriores ainda ativas (projetadas em JS) e honorários de contrato vigentes.
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(gte(transactions.date, from), lte(transactions.date, to), notTestClient)),
    db.select({ type: transactions.type, amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt, source: clients.source })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.isRecurring, "true"),
        eq(transactions.recurringActive, "true"),
        lt(transactions.date, from),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, from)),
        notTestClient
      )),
    db.select({ fixedAmount: contracts.fixedAmount, currency: contracts.currency, billingDay: contracts.billingDay, startDate: contracts.startDate, endDate: contracts.endDate, source: clients.source })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(and(
        lte(contracts.startDate, to),
        or(isNull(contracts.endDate), gte(contracts.endDate, from)),
        eq(contracts.status, "active"),
        notTestClient
      )),
    // Gráfico de receita (últimos 6 meses): receitas avulsas reais na janela +
    // recorrentes anteriores à janela ainda ativas (mesma lógica do resumo do período acima).
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.type, "income"),
        gte(transactions.date, sixMonthsAgo.toISOString().split("T")[0]!),
        notTestClient
      )),
    db.select({ amount: transactions.amount, currency: transactions.currency, date: transactions.date, recurringEndsAt: transactions.recurringEndsAt })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(and(
        eq(transactions.type, "income"),
        eq(transactions.isRecurring, "true"),
        eq(transactions.recurringActive, "true"),
        lt(transactions.date, sixMonthsAgo.toISOString().split("T")[0]!),
        or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, sixMonthsAgo.toISOString().split("T")[0]!)),
        notTestClient
      )),
  ]);

  const rateRow = latestRate[0];
  const rate = safeRates(
    rateRow ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) } : null
  );
  const displayCurrency = (displayCurrencySetting[0]?.value ?? "BRL") as Currency;

  // ── Resumo do período (mesma lógica do fluxo de caixa) ──
  const periodFromD = new Date(from + "T12:00:00");
  const periodToD = new Date(to + "T12:00:00");
  const periodMonths: Date[] = [];
  for (
    let d = new Date(periodFromD.getFullYear(), periodFromD.getMonth(), 1);
    d <= periodToD;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    periodMonths.push(new Date(d));
  }
  let periodIncome = 0;
  let periodExpense = 0;
  // Entradas do período agrupadas por canal de aquisição (para a Receita por Origem)
  const incomeBySource = new Map<string, number>();
  const addPeriod = (type: string, amount: string | null, currency: string | null, source?: string | null) => {
    const amt = parseFloat(amount ?? "0");
    const cur = (currency ?? "BRL") as Currency;
    const vDisplay = convertAmount(amt, cur, displayCurrency, rate); // cards do topo
    if (type === "income") {
      periodIncome += vDisplay;
      const vBrl = convertAmount(amt, cur, "BRL", rate); // tabela por origem converte BRL->display
      const k = source ?? "none";
      incomeBySource.set(k, (incomeBySource.get(k) ?? 0) + vBrl);
    } else if (type === "expense") {
      periodExpense += vDisplay;
    }
  };
  const dayInMonth = (m: Date, billingDay: number) => {
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const day = Math.min(billingDay, lastDay);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  for (const t of periodRealTx) addPeriod(t.type, t.amount, t.currency, t.source);
  for (const t of periodRecurringPast) {
    const originalDay = new Date(t.date + "T12:00:00").getDate();
    for (const m of periodMonths) {
      const dateStr = dayInMonth(m, originalDay);
      if (dateStr >= from && dateStr <= to && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        addPeriod(t.type, t.amount, t.currency, t.source);
      }
    }
  }
  for (const c of periodContracts) {
    for (const m of periodMonths) {
      const dateStr = dayInMonth(m, c.billingDay ?? 5);
      if (dateStr >= from && dateStr <= to && dateStr >= c.startDate && (c.endDate == null || dateStr <= c.endDate)) {
        addPeriod("income", c.fixedAmount, c.currency, c.source);
      }
    }
  }

  // MRR = soma dos contratos ativos, todos convertidos para BRL
  // O MetricCard recebe em BRL e converte para a moeda de exibição (sourceCurrency padrão = "BRL")
  const activeContracts = allContracts.filter((c) => isContractEarning(c.status, c.endDate));
  const mrr = activeContracts.reduce((sum, c) => {
    const amount = parseFloat(c.fixedAmount ?? "0");
    return sum + convertAmount(amount, (c.currency ?? "BRL") as Currency, "BRL", rate);
  }, 0);

  // Para o histórico mês a mês (gráficos), usamos o status BRUTO do contrato
  // (não o derivado em relação a hoje): um contrato finalizado no mês passado
  // ainda deve contar nos meses em que estava vigente. `isContractEarning`
  // compara com a data de hoje, então excluiria retroativamente esses meses.
  const nonCancelledContracts = allContracts.filter((c) => c.status === "active");

  // Agrupar despesas por "YYYY-MM" em JS (evita mismatch de locale com SQL)
  const expenseMap = new Map<string, number>();
  for (const t of expenseTransactions) {
    const key = t.date.slice(0, 7); // "YYYY-MM"
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + parseFloat(t.amount ?? "0"));
  }

  // Agrupar receitas avulsas reais por "YYYY-MM" (mesma base usada no fluxo de caixa)
  const incomeTxMap = new Map<string, number>();
  for (const t of sixMonthIncomeTx) {
    const key = t.date.slice(0, 7);
    const v = convertAmount(parseFloat(t.amount ?? "0"), (t.currency ?? "BRL") as Currency, "BRL", rate);
    incomeTxMap.set(key, (incomeTxMap.get(key) ?? 0) + v);
  }

  // Gerar dados do gráfico para os últimos 6 meses — mesma lógica do resumo do
  // período e do fluxo de caixa: só contrato ATIVO no dia exato de vencimento
  // (billingDay), recorrentes projetadas e receitas avulsas reais do mês.
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStartStr = d.toISOString().split("T")[0]!;
    const monthEndStr = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]!;
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    let monthIncome = 0;
    for (const c of nonCancelledContracts) {
      const dueDate = dayInMonth(d, c.billingDay ?? 5);
      if (dueDate >= monthStartStr && dueDate <= monthEndStr && dueDate >= c.startDate && (c.endDate == null || dueDate <= c.endDate)) {
        monthIncome += convertAmount(parseFloat(c.fixedAmount ?? "0"), (c.currency ?? "BRL") as Currency, "BRL", rate);
      }
    }

    // MRR do mês: contratos vigentes naquele mês (sem depender do dia exato de
    // vencimento nem de receita avulsa) — é o "quanto estava contratado", não o caixa.
    let monthMrr = 0;
    for (const c of nonCancelledContracts) {
      const cStart = c.startDate;
      const cEnd = c.endDate;
      if (cStart <= monthEndStr && (cEnd == null || cEnd >= monthStartStr)) {
        monthMrr += convertAmount(parseFloat(c.fixedAmount ?? "0"), (c.currency ?? "BRL") as Currency, "BRL", rate);
      }
    }

    for (const t of sixMonthRecurringPast) {
      const originalDay = new Date(t.date + "T12:00:00").getDate();
      const dateStr = dayInMonth(d, originalDay);
      if (dateStr >= monthStartStr && dateStr <= monthEndStr && (!t.recurringEndsAt || dateStr <= t.recurringEndsAt)) {
        monthIncome += convertAmount(parseFloat(t.amount ?? "0"), (t.currency ?? "BRL") as Currency, "BRL", rate);
      }
    }
    monthIncome += incomeTxMap.get(key) ?? 0;

    chartData.push({
      month: label,
      income: monthIncome,
      expense: expenseMap.get(key) ?? 0,
      mrr: monthMrr,
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
  // "total" = entradas do período por canal (contratos + avulsos), já no displayCurrency
  for (const [src, val] of incomeBySource) {
    ensureSource(src).total += val;
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
    periodIncome,
    periodExpense,
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  // Padrão: mês atual inteiro
  const to = sp.to ?? new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0]!;
  const from = sp.from ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]!;
  const data = await getDashboardData(from, to);

  const periodBalance = data.periodIncome - data.periodExpense;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-200">Visão geral</h1>
        <DateRangePicker from={from} to={to} />
      </div>

      {/* Resumo do período selecionado (dinheiro real movimentado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-green-500 before:to-transparent">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Entradas no período</p>
          <MaskedCurrency amount={data.periodIncome} currency={data.displayCurrency} className="text-xl font-bold text-green-400 tabular-nums" />
        </div>
        <div
          className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-red-500 before:to-transparent"
          style={{ animationDelay: "60ms" }}
        >
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Saídas no período</p>
          <MaskedCurrency amount={data.periodExpense} currency={data.displayCurrency} className="text-xl font-bold text-red-400 tabular-nums" />
        </div>
        <div
          className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:to-transparent ${periodBalance >= 0 ? "before:from-indigo-500" : "before:from-red-500"}`}
          style={{ animationDelay: "120ms" }}
        >
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Saldo no período</p>
          <MaskedCurrency amount={periodBalance} currency={data.displayCurrency} className={`text-xl font-bold tabular-nums ${periodBalance >= 0 ? "text-white" : "text-red-400"}`} />
        </div>
      </div>

      <DashboardMetrics
        mrr={data.mrr}
        monthExpense={data.monthExpense}
        activeClients={data.activeClients}
        overdueClients={data.overdueClients}
        overdueInvoicesCount={data.overdueInvoices.length}
        displayCurrency={data.displayCurrency}
        rate={data.rate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:240ms]">
        <RevenueChart data={data.chartData} />
        <MRRChart data={data.chartData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:300ms]">
        <SourceMrrBar rows={data.sourceBreakdown} />
        <SourceMrrTrend data={data.sourceTrendData} series={data.sourceSeries} />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:360ms]">
        <SourceBreakdown
          rows={data.sourceBreakdown}
          displayCurrency={data.displayCurrency}
          rate={data.rate}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:420ms]">
        <RecentInvoices invoices={data.recentInvoices} />
        <AlertsPanel overdue={data.overdueInvoices} upcoming={data.upcomingInvoices} />
      </div>
    </div>
  );
}

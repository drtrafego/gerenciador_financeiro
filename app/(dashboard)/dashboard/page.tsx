export const dynamic = "force-dynamic";

import { getDashboardData } from "@/lib/db/queries";
import DateRangePicker from "@/components/shared/DateRangePicker";
import MaskedCurrency from "@/components/shared/MaskedCurrency";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MRRChart from "@/components/dashboard/MRRChart";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import SourceBreakdown from "@/components/dashboard/SourceBreakdown";
import SourceMrrBar from "@/components/dashboard/SourceMrrBar";
import SourceMrrTrend from "@/components/dashboard/SourceMrrTrend";

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

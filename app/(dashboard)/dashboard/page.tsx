export const dynamic = "force-dynamic";

import { getDashboardData } from "@/lib/db/queries";
import PeriodBar from "@/components/shared/PeriodBar";
import { resolvePeriod, formatPeriodLabel } from "@/lib/period";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MRRChart from "@/components/dashboard/MRRChart";
import RecentInvoices from "@/components/dashboard/RecentInvoices";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import SourceBreakdown from "@/components/dashboard/SourceBreakdown";
import SourceMrrBar from "@/components/dashboard/SourceMrrBar";
import SourceMrrTrend from "@/components/dashboard/SourceMrrTrend";
import DashboardViewContainer from "@/components/dashboard/DashboardViewContainer";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const data = await getDashboardData(from, to);

  const periodBalance = data.periodReceived - data.periodExpense;
  const comparadoCom = formatPeriodLabel(data.previousPeriod);

  return (
    <DashboardViewContainer displayCurrency={data.displayCurrency} rate={data.rate}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-lg font-semibold text-zinc-200">Visão geral da Empresa</h1>
        </div>

        <PeriodBar from={from} to={to} />

        <DashboardMetrics
          received={data.periodReceived}
          toReceive={data.periodToReceive}
          expense={data.periodExpense}
          balance={periodBalance}
          previous={data.previous}
          comparadoCom={comparadoCom}
          displayCurrency={data.displayCurrency}
          rate={data.rate}
        />

        <DashboardMetrics
          variant="negocio"
          mrr={data.mrr}
          activeClients={data.activeClients}
          contratosNovos={data.contratosNovos}
          contratosEncerrados={data.contratosEncerrados}
          overdueClients={data.overdueClients}
          overdueAmount={data.overdueAmount}
          overdueInvoicesCount={data.overdueInvoices.length}
          previous={data.previous}
          comparadoCom={comparadoCom}
          displayCurrency={data.displayCurrency}
          rate={data.rate}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both [animation-delay:240ms]">
          <RevenueChart data={data.chartData} currency={data.chartCurrency} />
          <MRRChart data={data.chartData} currency={data.chartCurrency} displayCurrency={data.displayCurrency} />
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
    </DashboardViewContainer>
  );
}

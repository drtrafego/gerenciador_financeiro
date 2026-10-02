export const dynamic = "force-dynamic";

import PersonalDashboardView from "@/components/dashboard/PersonalDashboardView";
import { getDashboardData } from "@/lib/db/queries";
import { resolvePeriod } from "@/lib/period";

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const data = await getDashboardData(from, to);

  return <PersonalDashboardView displayCurrency={data.displayCurrency} rate={data.rate} />;
}

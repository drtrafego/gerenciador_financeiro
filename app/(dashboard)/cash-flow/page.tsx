export const dynamic = "force-dynamic";

import { getCashFlowData } from "@/lib/db/queries";
import CashFlowClient from "@/components/cashflow/CashFlowClient";
import { resolvePeriod } from "@/lib/period";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; year?: string; month?: string; to?: string }>;
}) {
  const params = await searchParams;
  // Mesma regra de período do dashboard, incluindo a compatibilidade com os
  // links antigos de ?month&year e o "hoje" no horário do Brasil.
  const { from, to } = resolvePeriod(params);

  const data = await getCashFlowData(from, to);

  return (
    <CashFlowClient
      transactions={data.transactions}
      contractIncomes={data.contractIncomes}
      rate={data.rate}
      displayCurrency={data.displayCurrency as any}
      from={from}
      to={to}
      clients={data.clients}
    />
  );
}

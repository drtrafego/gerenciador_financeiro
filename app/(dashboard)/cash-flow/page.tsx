export const dynamic = "force-dynamic";

import { getCashFlowData } from "@/lib/db/queries";
import CashFlowClient from "@/components/cashflow/CashFlowClient";

const iso = (d: Date) => d.toISOString().split("T")[0]!;

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; year?: string; month?: string; to?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();

  // Compatibilidade: se vier ?month&year (links antigos), usa o mês inteiro.
  let from: string;
  let to: string;
  if (params.from && params.to) {
    from = params.from;
    to = params.to;
  } else if (params.month && params.year) {
    const m = Number(params.month);
    const y = Number(params.year);
    from = iso(new Date(y, m - 1, 1));
    to = iso(new Date(y, m, 0));
  } else {
    // Padrão: mês atual inteiro
    from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

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

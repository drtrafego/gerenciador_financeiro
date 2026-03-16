export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { transactions, contracts, clients, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, and, gte, lte, or, isNull } from "drizzle-orm";
import CashFlowClient from "@/components/cashflow/CashFlowClient";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month ?? now.getMonth() + 1);
  const year = Number(params.year ?? now.getFullYear());

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = monthStart.toISOString().split("T")[0]!;
  const endDate = monthEnd.toISOString().split("T")[0]!;

  const [txData, contractData, latestRate, displayCurrencySetting] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .orderBy(desc(transactions.date)),
    // Contratos ativos (ou pausados/cancelados que já tinham início antes do fim do mês)
    // com o nome do cliente
    db
      .select({
        id: contracts.id,
        fixedAmount: contracts.fixedAmount,
        currency: contracts.currency,
        billingDay: contracts.billingDay,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        status: contracts.status,
        description: contracts.description,
        clientName: clients.name,
      })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .where(
        and(
          // Contrato iniciou antes ou durante este mês
          lte(contracts.startDate, endDate),
          // Contrato não terminou antes deste mês (ou não tem data de término)
          or(isNull(contracts.endDate), gte(contracts.endDate, startDate)),
          // Apenas contratos ativos
          eq(contracts.status, "active")
        )
      ),
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
  ]);

  const rateRow = latestRate[0];
  const usdBrl = Number(rateRow?.usdBrl);
  const usdArs = Number(rateRow?.usdArs);
  const rate =
    usdBrl > 0 && usdArs > 0
      ? { usd_brl: usdBrl, usd_ars: usdArs }
      : { usd_brl: 5.87, usd_ars: 1429 };

  // Mapear contratos para entradas de receita no fluxo de caixa
  const contractIncomes = contractData.map((c) => {
    const day = Math.min(c.billingDay ?? 5, monthEnd.getDate());
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      id: `contract-${c.id}`,
      type: "income" as const,
      category: "Contrato",
      description: c.clientName
        ? `Honorário — ${c.clientName}`
        : c.description ?? "Contrato mensal",
      amount: c.fixedAmount ?? "0",
      currency: c.currency ?? "BRL",
      date,
      isContract: true as const,
    };
  });

  return (
    <CashFlowClient
      transactions={txData}
      contractIncomes={contractIncomes}
      rate={rate}
      displayCurrency={(displayCurrencySetting[0]?.value ?? "BRL") as any}
      month={month}
      year={year}
    />
  );
}

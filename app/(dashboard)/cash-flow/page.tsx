import { db } from "@/lib/db";
import { transactions, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import CashFlowClient from "@/components/cashflow/CashFlowClient";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const now = new Date();
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const year = Number(searchParams.year ?? now.getFullYear());
  const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const [data, latestRate, displayCurrencySetting] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))
      .orderBy(desc(transactions.date)),
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
  ]);

  const rateRow = latestRate[0];
  const rate = rateRow
    ? { usd_brl: Number(rateRow.usdBrl), usd_ars: Number(rateRow.usdArs) }
    : { usd_brl: 5.87, usd_ars: 1429 };

  return (
    <CashFlowClient
      transactions={data}
      rate={rate}
      displayCurrency={(displayCurrencySetting[0]?.value ?? "BRL") as any}
      month={month}
      year={year}
    />
  );
}

export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { transactions, contracts, clients, exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq, and, gte, lte, or, isNull, lt, asc } from "drizzle-orm";
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

  const [txData, recurringFromPast, contractData, latestRate, displayCurrencySetting, clientList] = await Promise.all([
    // Transações reais dentro do intervalo
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, from), lte(transactions.date, to)))
      .orderBy(desc(transactions.date)),

    // Recorrentes que começaram ANTES do intervalo e seguem ativas (projetar nos meses do intervalo)
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.isRecurring, "true"),
          eq(transactions.recurringActive, "true"),
          lt(transactions.date, from),
          or(isNull(transactions.recurringEndsAt), gte(transactions.recurringEndsAt, from))
        )
      ),

    // Contratos cuja vigência cruza o intervalo
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
          lte(contracts.startDate, to),
          or(isNull(contracts.endDate), gte(contracts.endDate, from)),
          eq(contracts.status, "active")
        )
      ),

    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);

  const rateRow = latestRate[0];
  const usdBrl = Number(rateRow?.usdBrl);
  const usdArs = Number(rateRow?.usdArs);
  const rate =
    usdBrl > 0 && usdArs > 0 ? { usd_brl: usdBrl, usd_ars: usdArs } : { usd_brl: 5.87, usd_ars: 1429 };

  // Lista de "primeiro dia de cada mês" entre from e to
  const fromD = new Date(from + "T12:00:00");
  const toD = new Date(to + "T12:00:00");
  const months: Date[] = [];
  for (let d = new Date(fromD.getFullYear(), fromD.getMonth(), 1); d <= toD; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push(new Date(d));
  }

  // Honorário de cada contrato em cada mês do intervalo (respeitando billingDay e vigência)
  const contractIncomes = [];
  for (const c of contractData) {
    for (const m of months) {
      const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const day = Math.min(c.billingDay ?? 5, lastDay);
      const dateStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const withinRange = dateStr >= from && dateStr <= to;
      const withinContract = dateStr >= c.startDate && (c.endDate == null || dateStr <= c.endDate);
      if (withinRange && withinContract) {
        contractIncomes.push({
          id: `contract-${c.id}-${dateStr}`,
          type: "income" as const,
          category: "Contrato",
          description: c.clientName ? `Honorário — ${c.clientName}` : c.description ?? "Contrato mensal",
          amount: c.fixedAmount ?? "0",
          currency: c.currency ?? "BRL",
          date: dateStr,
          isContract: true as const,
        });
      }
    }
  }

  // Projeção das recorrentes de meses anteriores para cada mês do intervalo
  const projectedRecurring = [];
  for (const t of recurringFromPast) {
    const originalDay = new Date(t.date + "T12:00:00").getDate();
    for (const m of months) {
      const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const day = Math.min(originalDay, lastDay);
      const dateStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const withinRange = dateStr >= from && dateStr <= to;
      const notEnded = !t.recurringEndsAt || dateStr <= t.recurringEndsAt;
      if (withinRange && notEnded) {
        projectedRecurring.push({ ...t, date: dateStr, isProjected: true as const });
      }
    }
  }

  const allTransactions = [...txData, ...projectedRecurring];

  return (
    <CashFlowClient
      transactions={allTransactions}
      contractIncomes={contractIncomes}
      rate={rate}
      displayCurrency={(displayCurrencySetting[0]?.value ?? "BRL") as any}
      from={from}
      to={to}
      clients={clientList}
    />
  );
}

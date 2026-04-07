export const dynamic = "force-dynamic";

import { getTransactions } from "@/lib/db/queries";
import { deleteTransactionAction } from "./actions";
import TransactionsClient from "@/components/transactions/TransactionsClient";

export default async function TransactionsPage() {
  const rows = await getTransactions();

  const totalIncome = rows
    .filter((r) => r.transaction.type === "income")
    .reduce((s, r) => s + parseFloat(r.transaction.amount ?? "0"), 0);
  const totalExpense = rows
    .filter((r) => r.transaction.type === "expense")
    .reduce((s, r) => s + parseFloat(r.transaction.amount ?? "0"), 0);

  const rowsWithActions = rows.map((r) => ({
    transaction: r.transaction,
    clientName: r.clientName ?? null,
    deleteAction: deleteTransactionAction.bind(null, r.transaction.id),
  }));

  return (
    <TransactionsClient
      rows={rowsWithActions}
      totalIncome={totalIncome}
      totalExpense={totalExpense}
    />
  );
}

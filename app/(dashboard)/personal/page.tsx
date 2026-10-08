export const dynamic = "force-dynamic";

import PersonalDashboardView from "@/components/dashboard/PersonalDashboardView";
import { getDashboardData } from "@/lib/db/queries";
import { resolvePeriod } from "@/lib/period";
import { stackServerApp } from "@/stack/server";
import {
  getPersonalCustomTransactions,
  getPersonalDeletedIds,
  getPersonalCategories,
  deduplicateTransactions,
  PersonalTransaction,
} from "@/lib/agent/services/personalTransactions";
import { PERSONAL_TRANSACTIONS } from "@/lib/transactionData";

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const data = await getDashboardData(from, to);

  let userEmail = '';
  let userName = '';
  try {
    const stackUser = await stackServerApp.getUser();
    userEmail = stackUser?.primaryEmail || '';
    userName = stackUser?.displayName || '';
  } catch {}

  const isAmanda = userEmail.toLowerCase().includes('amanda');
  const currentUser = {
    email: userEmail,
    name: userName || (isAmanda ? 'Amanda' : 'Gastão'),
    role: (isAmanda ? 'Amanda' : 'Gastão') as 'Amanda' | 'Gastão',
  };

  const [customTxs, deletedSet, customCategories] = await Promise.all([
    getPersonalCustomTransactions(),
    getPersonalDeletedIds(),
    getPersonalCategories(),
  ]);

  const allMerged = [...customTxs, ...(PERSONAL_TRANSACTIONS as any[])].filter(
    (t) => !deletedSet.has(t.id)
  );
  const serverTxs: PersonalTransaction[] = deduplicateTransactions(allMerged);

  return (
    <PersonalDashboardView
      displayCurrency={data.displayCurrency}
      rate={data.rate}
      initialTransactions={serverTxs}
      initialCategories={customCategories.length > 0 ? customCategories : undefined}
      currentUser={currentUser}
    />
  );
}

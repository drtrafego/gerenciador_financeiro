import { stackServerApp } from "@/stack/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";
import { ValuesVisibilityProvider } from "@/lib/contexts/ValuesVisibilityContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await stackServerApp.getUser({ or: "redirect" });

  const [currencySetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "display_currency"))
    .limit(1);

  const displayCurrency = (currencySetting?.value ?? "BRL") as "BRL" | "USD" | "ARS";

  return (
    <ValuesVisibilityProvider>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header displayCurrency={displayCurrency} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </ValuesVisibilityProvider>
  );
}

import { stackServerApp } from "@/stack/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";
import { ValuesVisibilityProvider } from "@/lib/contexts/ValuesVisibilityContext";
import { SidebarProvider } from "@/lib/contexts/SidebarContext";

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
      <SidebarProvider>
        <div className="flex h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden">
          <Sidebar />
          {/* min-w-0 é obrigatório: sem ele, flex-1 tem min-width auto e qualquer
              filho largo estica o container em vez de rolar dentro dele. */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Header displayCurrency={displayCurrency} />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </ValuesVisibilityProvider>
  );
}

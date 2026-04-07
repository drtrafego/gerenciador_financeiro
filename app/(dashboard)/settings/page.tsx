export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { exchangeRates, systemSettings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ExchangeRateWidget } from "@/components/settings/ExchangeRateWidget";
import CurrencyPreference from "@/components/settings/CurrencyPreference";
import AgencySettings from "@/components/settings/AgencySettings";
import HideValuesPreference from "@/components/settings/HideValuesPreference";

export default async function SettingsPage() {
  const [latestRate, displayCurrencySetting, agencyName, agencyEmail] = await Promise.all([
    db.select().from(exchangeRates).orderBy(desc(exchangeRates.fetchedAt)).limit(1),
    db.select().from(systemSettings).where(eq(systemSettings.key, "display_currency")),
    db.select().from(systemSettings).where(eq(systemSettings.key, "agency_name")),
    db.select().from(systemSettings).where(eq(systemSettings.key, "agency_email")),
  ]);

  const cronSecret = process.env.CRON_SECRET ?? "";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white">Configurações</h1>

      <ExchangeRateWidget rate={latestRate[0] ?? null} cronSecret={cronSecret} />

      <CurrencyPreference current={(displayCurrencySetting[0]?.value ?? "BRL") as any} />

      <HideValuesPreference />

      <AgencySettings
        name={agencyName[0]?.value ?? "DR.TRÁFEGO"}
        email={agencyEmail[0]?.value ?? ""}
      />
    </div>
  );
}

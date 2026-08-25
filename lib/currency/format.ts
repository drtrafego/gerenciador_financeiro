export type Currency = "BRL" | "USD" | "ARS";

const SUPPORTED_CURRENCIES: readonly Currency[] = ["BRL", "USD", "ARS"];

// A coluna currency do banco é text com default 'BRL': não é enum e não é
// notNull. Além de null, ela pode chegar como string vazia ou como uma moeda
// que o app não suporta. Sem normalizar, o formatCurrency estoura em runtime
// (formatters[currency] fica undefined) e o convertAmount trata o valor como
// dólar em silêncio. Qualquer coisa fora da lista suportada vira BRL.
export function asCurrency(value: string | null | undefined): Currency {
  return SUPPORTED_CURRENCIES.includes(value as Currency) ? (value as Currency) : "BRL";
}

export type RatesMap = {
  usd_brl: number;
  usd_ars: number;
  ars_brl?: number; // opcional — derivado dos outros dois
};

export function formatCurrency(amount: number, currency: Currency): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    BRL: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    ARS: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }),
  };
  return formatters[currency].format(amount);
}

// Taxas de fallback usadas quando o banco não tem cotações válidas
const FALLBACK_RATES = { usd_brl: 5.87, usd_ars: 1429 };

export function safeRates(rates?: { usd_brl: number; usd_ars: number } | null) {
  const usdBrl = Number(rates?.usd_brl);
  const usdArs = Number(rates?.usd_ars);
  return {
    usd_brl: usdBrl > 0 ? usdBrl : FALLBACK_RATES.usd_brl,
    usd_ars: usdArs > 0 ? usdArs : FALLBACK_RATES.usd_ars,
  };
}

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: { usd_brl: number; usd_ars: number }
): number {
  if (from === to) return amount;

  // Garante taxas válidas mesmo se o banco tiver valores ruins
  const r = safeRates(rates);

  // Normalizar para USD como moeda intermediária
  const inUSD =
    from === "BRL" ? amount / r.usd_brl :
    from === "ARS" ? amount / r.usd_ars :
    amount; // USD

  return (
    to === "BRL" ? inUSD * r.usd_brl :
    to === "ARS" ? inUSD * r.usd_ars :
    inUSD // USD
  );
}

export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    BRL: "R$",
    USD: "$",
    ARS: "$",
  };
  return symbols[currency];
}

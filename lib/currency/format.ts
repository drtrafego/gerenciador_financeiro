export type Currency = "BRL" | "USD" | "ARS";

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

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: { usd_brl: number; usd_ars: number }
): number {
  if (from === to) return amount;

  // Normalizar tudo para USD
  const toUSD: Record<Currency, number> = {
    BRL: amount / rates.usd_brl,
    USD: amount,
    ARS: amount / rates.usd_ars,
  };
  const inUSD = toUSD[from];

  const fromUSD: Record<Currency, number> = {
    BRL: inUSD * rates.usd_brl,
    USD: inUSD,
    ARS: inUSD * rates.usd_ars,
  };

  return fromUSD[to];
}

export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    BRL: "R$",
    USD: "$",
    ARS: "$",
  };
  return symbols[currency];
}

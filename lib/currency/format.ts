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

/**
 * Converte strings ou números digitados no padrão brasileiro (ex: "10.000,00", "10.000", "10000,00")
 * em números válidos para persistência e cálculos.
 */
export function parseBrazilianCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  // Remove símbolos monetários (R$, $, etc.) e espaços
  str = str.replace(/[R$\s]/g, '');

  if (!str) return 0;

  // Possui ponto e vírgula (ex: 10.000,00 ou 1.250,50)
  if (str.includes('.') && str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }

  // Possui apenas vírgula (ex: 10000,00 ou 150,50)
  if (str.includes(',')) {
    const normalized = str.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }

  // Possui apenas ponto(s) (ex: 10.000 ou 1.000.000 ou 10.50)
  if (str.includes('.')) {
    const parts = str.split('.');
    // Mais de um ponto: são separadores de milhar (ex: 1.000.000)
    if (parts.length > 2) {
      const normalized = parts.join('');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
    // Ex: "10.000" (exatamente 3 dígitos após o ponto -> separador de milhar brasileiro)
    if (parts[1].length === 3) {
      const normalized = str.replace('.', '');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
    // Caso com 1 ou 2 casas decimais (ex: 10.5 ou 10.50)
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formata um número no padrão brasileiro com ponto de milhar e vírgula decimal (ex: 10.000,00).
 */
export function formatBrazilianNumber(value: number | null | undefined, includeDecimals = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(value);
}


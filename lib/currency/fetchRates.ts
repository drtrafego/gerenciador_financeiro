export type Rates = {
  USD_BRL: number;
  USD_ARS: number;
  ARS_BRL: number;
  source: string;
};

export async function fetchLatestRates(): Promise<Rates> {
  // Tentativa 1: Frankfurter (Banco Central Europeu)
  try {
    const res = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,ARS',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      const USD_BRL = data.rates.BRL;
      const USD_ARS = data.rates.ARS;
      return {
        USD_BRL,
        USD_ARS,
        ARS_BRL: USD_BRL / USD_ARS,
        source: 'frankfurter',
      };
    }
  } catch {}

  // Tentativa 2: ExchangeRate-API (open access, sem key)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const USD_BRL = data.rates.BRL;
      const USD_ARS = data.rates.ARS;
      return {
        USD_BRL,
        USD_ARS,
        ARS_BRL: USD_BRL / USD_ARS,
        source: 'er-api',
      };
    }
  } catch {}

  // Tentativa 3: fawazahmed0 via jsDelivr CDN
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    { cache: 'no-store' }
  );
  const data = await res.json();
  const USD_BRL = data.usd.brl;
  const USD_ARS = data.usd.ars;
  return {
    USD_BRL,
    USD_ARS,
    ARS_BRL: USD_BRL / USD_ARS,
    source: 'fawazahmed0',
  };
}

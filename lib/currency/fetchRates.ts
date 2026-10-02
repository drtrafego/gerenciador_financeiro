export type Rates = {
  USD_BRL: number;
  USD_ARS: number;
  ARS_BRL: number;
  source: string;
};

export async function fetchLatestRates(): Promise<Rates> {
  // Tentativa 1: DolarApi (Especializada no mercado argentino - BCRA e Câmbio Livre)
  try {
    const [brlRes, usdRes] = await Promise.all([
      fetch('https://dolarapi.com/v1/cotizaciones/brl', { cache: 'no-store' }),
      fetch('https://dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }),
    ]);

    if (brlRes.ok && usdRes.ok) {
      const brlData = await brlRes.json();
      const usdData = await usdRes.json();

      const arsPerBrl = Number(brlData.venta);
      const usdArs = Number(usdData.venta);

      if (arsPerBrl > 0 && usdArs > 0) {
        const usdBrl = usdArs / arsPerBrl;
        return {
          USD_BRL: Number(usdBrl.toFixed(4)),
          USD_ARS: usdArs,
          ARS_BRL: Number((1 / arsPerBrl).toFixed(6)),
          source: 'dolarapi',
        };
      }
    }
  } catch {}

  // Tentativa 2: Frankfurter (Banco Central Europeu)
  // Nota: ECB não cobre ARS, então validamos antes de retornar
  try {
    const res = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,ARS',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      const USD_BRL = Number(data.rates?.BRL);
      const USD_ARS = Number(data.rates?.ARS);
      if (USD_BRL > 0 && USD_ARS > 0) {
        return {
          USD_BRL,
          USD_ARS,
          ARS_BRL: USD_BRL / USD_ARS,
          source: 'frankfurter',
        };
      }
    }
  } catch {}

  // Tentativa 2: ExchangeRate-API (open access, sem key)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const USD_BRL = Number(data.rates?.BRL);
      const USD_ARS = Number(data.rates?.ARS);
      if (USD_BRL > 0 && USD_ARS > 0) {
        return {
          USD_BRL,
          USD_ARS,
          ARS_BRL: USD_BRL / USD_ARS,
          source: 'er-api',
        };
      }
    }
  } catch {}

  // Tentativa 3: fawazahmed0 via jsDelivr CDN
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Todas as APIs de cotação falharam');
  const data = await res.json();
  const USD_BRL = Number(data.usd?.brl);
  const USD_ARS = Number(data.usd?.ars);
  if (!USD_BRL || !USD_ARS) throw new Error('Cotações inválidas na resposta da API');
  return {
    USD_BRL,
    USD_ARS,
    ARS_BRL: USD_BRL / USD_ARS,
    source: 'fawazahmed0',
  };
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let arsPerBrlOficial = 291.67;
    let arsPerBrlBlue = 299.4;
    let usdBrl = 5.19;
    let usdArsOficial = 1545;
    let usdArsBlue = 1555;
    let source = 'DolarApi & ExchangeRate-API';
    let fetchedAt = new Date().toISOString();

    // 1. Tentar DolarApi (especializada no mercado argentino oficial e paralelo)
    try {
      const [brlRes, blueRes, usdRes] = await Promise.all([
        fetch('https://dolarapi.com/v1/cotizaciones/brl', { cache: 'no-store' }),
        fetch('https://dolarapi.com/v1/dolares/blue', { cache: 'no-store' }),
        fetch('https://dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }),
      ]);

      if (brlRes.ok) {
        const brlData = await brlRes.json();
        const venta = Number(brlData.venta);
        if (venta > 0) {
          arsPerBrlOficial = venta;
          fetchedAt = brlData.fechaActualizacion || fetchedAt;
        }
      }

      if (blueRes.ok) {
        const blueData = await blueRes.json();
        const blueVenta = Number(blueData.venta);
        if (blueVenta > 0) {
          usdArsBlue = blueVenta;
        }
      }

      if (usdRes.ok) {
        const usdData = await usdRes.json();
        const usdVenta = Number(usdData.venta);
        if (usdVenta > 0) {
          usdArsOficial = usdVenta;
        }
      }
    } catch (e) {
      console.warn('DolarApi fetch warning:', e);
    }

    // 2. Tentar ExchangeRate-API para taxa USD/BRL e fallback de cruzamento
    try {
      const erRes = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
      if (erRes.ok) {
        const erData = await erRes.json();
        const rateBrl = Number(erData.rates?.BRL);
        const rateArs = Number(erData.rates?.ARS);
        if (rateBrl > 0 && rateArs > 0) {
          usdBrl = rateBrl;
          if (!arsPerBrlOficial) {
            arsPerBrlOficial = Number((rateArs / rateBrl).toFixed(2));
          }
          if (usdArsBlue > 0) {
            arsPerBrlBlue = Number((usdArsBlue / rateBrl).toFixed(2));
          }
        }
      }
    } catch (e) {
      console.warn('ER-API fetch warning:', e);
    }

    return NextResponse.json({
      success: true,
      source,
      rates: {
        arsPerBrlOficial: Number(arsPerBrlOficial.toFixed(2)),
        arsPerBrlBlue: Number(arsPerBrlBlue.toFixed(2)),
        arsPerBrl: Number(arsPerBrlBlue.toFixed(2)),
        usdBrl: Number(usdBrl.toFixed(4)),
        usdArs: Number(usdArsOficial.toFixed(2)),
        usdArsBlue: Number(usdArsBlue.toFixed(2)),
      },
      fetchedAt,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('Erro na rota /api/currency/rates:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      rates: {
        arsPerBrlOficial: 291.67,
        arsPerBrlBlue: 299.4,
        arsPerBrl: 291.67,
        usdBrl: 5.19,
        usdArs: 1545,
        usdArsBlue: 1555,
      },
    }, { status: 500 });
  }
}

import { db } from '@/lib/db/drizzle';
import { exchangeRates } from '@/lib/db/schema';
import { fetchLatestRates } from '@/lib/currency/fetchRates';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const rates = await fetchLatestRates();

    await db.insert(exchangeRates).values({
      usdBrl: String(rates.USD_BRL),
      usdArs: String(rates.USD_ARS),
      arsBrl: String(rates.ARS_BRL),
      source: rates.source,
    });

    return Response.json({
      success: true,
      rates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao atualizar cotações:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

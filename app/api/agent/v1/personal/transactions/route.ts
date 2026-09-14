import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPersonalTransactionSchema = z.object({
  date: z.string(),
  merchant: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'BRL', 'USD']).default('ARS'),
  type: z.enum(['income', 'expense']).default('expense'),
  category: z.string().default('Geral'),
  childTag: z.string().optional(),
  paymentMethod: z.string().optional(),
  language: z.enum(['pt', 'es']).default('pt'),
});

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const typeParam = url.searchParams.get('type');
  const currencyParam = url.searchParams.get('currency');

  const conditions = [];
  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));

  const items = await db
    .select()
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date))
    .limit(limit)
    .offset(offset);

  return {
    status: 200,
    body: {
      data: items,
      count: items.length,
      limit,
      offset,
    },
    resourceType: 'personal_transaction',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = createPersonalTransactionSchema.parse(body);

  const [inserted] = await db
    .insert(transactions)
    .values({
      date: parsed.date,
      description: `${parsed.merchant}${parsed.description ? ` - ${parsed.description}` : ''}`,
      amount: parsed.amount.toString(),
      currency: parsed.currency,
      type: parsed.type,
      category: parsed.category,
    })
    .returning();

  return {
    status: 201,
    body: { data: inserted, message: "Transação pessoal registrada com sucesso!" },
    resourceType: 'personal_transaction',
    resourceId: inserted.id,
    requestBody: parsed,
    afterData: inserted,
  };
});

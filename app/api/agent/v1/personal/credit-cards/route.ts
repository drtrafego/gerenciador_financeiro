import { withAgentAuth } from '@/lib/agent/route';
import { z } from 'zod';

const createCardSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  currency: z.enum(['ARS', 'BRL', 'USD']).default('ARS'),
  closingDay: z.number().min(1).max(31).default(20),
  dueDay: z.number().min(1).max(31).default(5),
  limit: z.number().positive(),
  baseInvoice: z.number().min(0).default(0),
  color: z.string().optional(),
});

const DEFAULT_CARDS = [
  {
    id: "card-galicia",
    name: "Tarjeta Visa Signature",
    bank: "Banco Galicia (Argentina)",
    currency: "ARS",
    closingDay: 24,
    dueDay: 5,
    limit: 3500000,
    baseInvoice: 0,
    color: "from-amber-600 to-orange-700"
  },
  {
    id: "card-nubank",
    name: "Cartão Nubank Ultravioleta",
    bank: "Nubank (Brasil)",
    currency: "BRL",
    closingDay: 15,
    dueDay: 22,
    limit: 25000,
    baseInvoice: 0,
    color: "from-purple-600 to-indigo-800"
  }
];

export const GET = withAgentAuth(async () => {
  return {
    status: 200,
    body: {
      data: DEFAULT_CARDS,
      count: DEFAULT_CARDS.length,
    },
    resourceType: 'personal_credit_cards',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = createCardSchema.parse(body);

  const newCard = {
    id: `card-${Date.now()}`,
    name: parsed.name,
    bank: parsed.bank,
    currency: parsed.currency,
    closingDay: parsed.closingDay,
    dueDay: parsed.dueDay,
    limit: parsed.limit,
    baseInvoice: parsed.baseInvoice,
    color: parsed.color || "from-purple-600 to-indigo-800",
  };

  return {
    status: 201,
    body: {
      data: newCard,
      message: `Cartão de crédito ${parsed.name} registrado com sucesso!`,
    },
    resourceType: 'personal_credit_cards',
    requestBody: parsed,
  };
});

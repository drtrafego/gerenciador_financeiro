import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, transactions } from '@/lib/db/schema';
import { getTransactionById, createTransaction, updateTransaction, deactivateRecurringTransaction } from '@/lib/db/queries';
import { notFound, badRequest } from '../errors';

const transactionCreateSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(), // valor efetivo (com IOF, se houver)
  baseAmount: z.number().positive().nullable().optional(), // valor original digitado, sem IOF
  iof: z.boolean().optional().default(false),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  date: z.string().min(1),
  isRecurring: z.boolean().optional().default(false),
  recurringEndsAt: z.string().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  installments: z.number().int().min(1).max(60).optional().default(1),
});

const transactionUpdateSchema = transactionCreateSchema.omit({ installments: true }).partial();

// Mesma constante usada no resto do projeto (server/actions/recurringExpenses.ts,
// components/cashflow/TransactionModal.tsx e RecurringExpensesModal.tsx).
const IOF_RATE = 0.0338;

// O valor final (amount) nunca é aceito diretamente do chamador quando iof é
// aplicado: o servidor sempre recalcula a partir de baseAmount * (1 + IOF_RATE),
// arredondado a 2 casas, ignorando qualquer amount enviado no body. Quando iof é
// false, amount vem do baseAmount sem multiplicar; se baseAmount não foi
// informado (transação sem conceito de IOF), cai no amount enviado como fallback.
function resolveAmount(
  iof: boolean,
  baseAmount: number | null | undefined,
  fallbackAmount: number | undefined
): number {
  if (iof) {
    if (baseAmount == null) {
      throw badRequest('baseAmount é obrigatório quando iof é true.');
    }
    return Number((baseAmount * (1 + IOF_RATE)).toFixed(2));
  }
  if (baseAmount != null) return baseAmount;
  if (fallbackAmount != null) return fallbackAmount;
  throw badRequest('Informe amount ou baseAmount.');
}

// Soma meses a uma data 'YYYY-MM-DD', preservando o dia (com clamp ao fim do mês).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y!, m! - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d!, lastDay);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function revalidateAll() {
  revalidatePath('/cash-flow');
  revalidatePath('/dashboard');
  revalidatePath('/transactions');
}

export async function listTransactions({
  from,
  to,
  type,
  clientId,
  limit,
  offset,
}: {
  from?: string;
  to?: string;
  type?: 'income' | 'expense';
  clientId?: string;
  limit: number;
  offset: number;
}) {
  const conditions = [];
  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));
  if (type) conditions.push(eq(transactions.type, type));
  if (clientId) conditions.push(eq(transactions.clientId, clientId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ transaction: transactions, clientName: clients.name, clientIsTest: clients.isTest })
      .from(transactions)
      .leftJoin(clients, eq(transactions.clientId, clients.id))
      .where(where)
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(where),
  ]);
  return { data: rows, count: Number(count) };
}

export async function getTransactionDetail(id: string) {
  const row = await getTransactionById(id);
  if (!row) throw notFound('Transação');
  return row;
}

// Suporta parcelamento igual ao modal do dashboard: divide o valor TOTAL em n
// parcelas mensais (última absorve o arredondamento), sem recorrência.
export async function createTransactionService(input: unknown) {
  const parsed = transactionCreateSchema.parse(input);
  const n = parsed.installments ?? 1;
  const created = [];
  const finalAmount = resolveAmount(parsed.iof, parsed.baseAmount ?? null, parsed.amount);

  if (n <= 1) {
    const tx = await createTransaction({
      type: parsed.type,
      category: parsed.category,
      description: parsed.description,
      amount: String(finalAmount),
      baseAmount: parsed.baseAmount != null ? String(parsed.baseAmount) : null,
      iof: parsed.iof,
      currency: parsed.currency,
      date: parsed.date,
      clientId: parsed.clientId ?? null,
      invoiceId: parsed.invoiceId ?? null,
      isRecurring: parsed.isRecurring ? 'true' : 'false',
      recurringActive: 'true',
      recurringEndsAt: parsed.recurringEndsAt ?? null,
    });
    created.push(tx);
  } else {
    const amtCents = Math.round(finalAmount * 100);
    const amtBase = Math.floor(amtCents / n);
    const amtRem = amtCents - amtBase * n;
    const baseCents = parsed.baseAmount != null ? Math.round(parsed.baseAmount * 100) : null;
    const baseBase = baseCents != null ? Math.floor(baseCents / n) : null;
    const baseRem = baseCents != null ? baseCents - baseBase! * n : 0;
    for (let i = 0; i < n; i++) {
      const a = (amtBase + (i === n - 1 ? amtRem : 0)) / 100;
      const b = baseCents != null ? (baseBase! + (i === n - 1 ? baseRem : 0)) / 100 : null;
      const tx = await createTransaction({
        type: parsed.type,
        category: parsed.category,
        description: `${parsed.description} (${i + 1}/${n})`,
        amount: String(a),
        baseAmount: b != null ? String(b) : null,
        iof: parsed.iof,
        currency: parsed.currency,
        date: addMonths(parsed.date, i),
        clientId: parsed.clientId ?? null,
        invoiceId: parsed.invoiceId ?? null,
        isRecurring: 'false',
        recurringActive: 'true',
        recurringEndsAt: null,
      });
      created.push(tx);
    }
  }

  revalidateAll();
  return { transactions: created, parsed };
}

export async function updateTransactionService(id: string, input: unknown) {
  const before = await getTransactionById(id);
  if (!before) throw notFound('Transação');

  const parsed = transactionUpdateSchema.parse(input);

  // amount só é recalculado quando a atualização mexe em amount, baseAmount ou
  // iof; nos demais casos o valor gravado no banco não é tocado. Quando mexe,
  // usa os valores efetivos (novos, com fallback pro que já estava salvo).
  const touchesAmount = parsed.iof !== undefined || parsed.baseAmount !== undefined || parsed.amount !== undefined;
  let resolvedAmount: number | undefined;
  if (touchesAmount) {
    const effectiveIof = parsed.iof !== undefined ? parsed.iof : (before.transaction.iof ?? false);
    const effectiveBaseAmount =
      parsed.baseAmount !== undefined
        ? parsed.baseAmount
        : before.transaction.baseAmount != null
        ? Number(before.transaction.baseAmount)
        : null;
    const fallbackAmount =
      parsed.amount !== undefined
        ? parsed.amount
        : before.transaction.amount != null
        ? Number(before.transaction.amount)
        : undefined;
    resolvedAmount = resolveAmount(effectiveIof, effectiveBaseAmount, fallbackAmount);
  }

  const tx = await updateTransaction(id, {
    ...(parsed.type !== undefined && { type: parsed.type }),
    ...(parsed.category !== undefined && { category: parsed.category }),
    ...(parsed.description !== undefined && { description: parsed.description }),
    ...(resolvedAmount !== undefined && { amount: String(resolvedAmount) }),
    ...(parsed.baseAmount !== undefined && { baseAmount: parsed.baseAmount != null ? String(parsed.baseAmount) : null }),
    ...(parsed.iof !== undefined && { iof: parsed.iof }),
    ...(parsed.currency !== undefined && { currency: parsed.currency }),
    ...(parsed.date !== undefined && { date: parsed.date }),
    ...(parsed.clientId !== undefined && { clientId: parsed.clientId ?? null }),
    ...(parsed.invoiceId !== undefined && { invoiceId: parsed.invoiceId ?? null }),
    ...(parsed.isRecurring !== undefined && { isRecurring: parsed.isRecurring ? 'true' : 'false' }),
    ...(parsed.recurringEndsAt !== undefined && { recurringEndsAt: parsed.recurringEndsAt ?? null }),
  });
  revalidateAll();
  return { before, after: tx, parsed };
}

export async function deactivateRecurringService(id: string) {
  const before = await getTransactionById(id);
  if (!before) throw notFound('Transação');

  const tx = await deactivateRecurringTransaction(id);
  revalidatePath('/cash-flow');
  revalidatePath('/transactions');
  return { before, after: tx };
}

// Corrige um lançamento errado sem apagar a linha original: cria um NOVO
// lançamento de sinal oposto (income <-> expense), mesmo valor e mesma data do
// original (para zerar o efeito no fluxo de caixa daquele mês), referenciando
// o original na descrição (não há coluna de referência na tabela transactions).
export async function reverseTransactionService(id: string) {
  const original = await getTransactionById(id);
  if (!original) throw notFound('Transação');

  const t = original.transaction;
  if (t.isRecurring === 'true') {
    throw badRequest('Não é possível estornar uma transação recorrente. Desative a recorrência primeiro.');
  }

  const reversedType = t.type === 'income' ? 'expense' : 'income';
  const reversal = await createTransaction({
    type: reversedType,
    category: t.category,
    description: `Estorno de "${t.description}" (ref: ${t.id})`,
    amount: t.amount,
    baseAmount: t.baseAmount,
    iof: t.iof,
    currency: t.currency,
    date: t.date,
    clientId: t.clientId,
    invoiceId: null,
    isRecurring: 'false',
    recurringActive: 'true',
    recurringEndsAt: null,
  });

  revalidateAll();
  return { original: t, reversal };
}

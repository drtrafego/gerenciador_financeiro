import { withAgentAuth } from '@/lib/agent/route';
import { parsePagination } from '@/lib/agent/pagination';
import { PERSONAL_TRANSACTIONS } from '@/lib/transactionData';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const createPersonalTransactionSchema = z.object({
  date: z.string(),
  merchant: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'BRL', 'USD']).default('ARS'),
  type: z.enum(['income', 'expense']).default('expense'),
  category: z.string().default('Geral'),
  subcategory: z.string().optional(),
  childTag: z.string().optional(),
  paymentMethod: z.string().optional(),
  language: z.enum(['pt', 'es']).default('pt'),
});

// Helpers de persistência em system_settings com fallback local
const CUSTOM_TX_KEY = 'personal_custom_transactions';
const DELETED_TX_KEY = 'personal_deleted_tx_ids';

async function getCustomTransactions(): Promise<any[]> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, CUSTOM_TX_KEY))
      .limit(1);
    if (row?.value) {
      return JSON.parse(row.value);
    }
  } catch (e) {
    // Fallback para arquivo local se banco falhar
    const filePath = path.join(process.cwd(), 'data', 'personal_custom_transactions.json');
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {}
    }
  }
  return [];
}

async function saveCustomTransactions(list: any[]) {
  const jsonStr = JSON.stringify(list);
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, CUSTOM_TX_KEY))
      .limit(1);
    if (existing) {
      await db
        .update(systemSettings)
        .set({ value: jsonStr, updatedAt: new Date() })
        .where(eq(systemSettings.key, CUSTOM_TX_KEY));
    } else {
      await db
        .insert(systemSettings)
        .values({ key: CUSTOM_TX_KEY, value: jsonStr });
    }
  } catch {}

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'personal_custom_transactions.json'), jsonStr, 'utf8');
  } catch {}
}

async function getDeletedTransactionIds(): Promise<Set<string>> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, DELETED_TX_KEY))
      .limit(1);
    if (row?.value) {
      const arr = JSON.parse(row.value);
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {}

  const filePath = path.join(process.cwd(), 'data', 'personal_deleted_ids.json');
  if (fs.existsSync(filePath)) {
    try {
      const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {}
  }
  return new Set();
}

async function addDeletedTransactionId(id: string) {
  const deletedSet = await getDeletedTransactionIds();
  deletedSet.add(id);
  const arr = Array.from(deletedSet);
  const jsonStr = JSON.stringify(arr);

  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, DELETED_TX_KEY))
      .limit(1);
    if (existing) {
      await db
        .update(systemSettings)
        .set({ value: jsonStr, updatedAt: new Date() })
        .where(eq(systemSettings.key, DELETED_TX_KEY));
    } else {
      await db
        .insert(systemSettings)
        .values({ key: DELETED_TX_KEY, value: jsonStr });
    }
  } catch {}

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'personal_deleted_ids.json'), jsonStr, 'utf8');
  } catch {}
}

export const GET = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const typeParam = url.searchParams.get('type');
  const currencyParam = url.searchParams.get('currency');
  const categoryParam = url.searchParams.get('category');
  const personParam = (url.searchParams.get('childTag') || url.searchParams.get('member') || url.searchParams.get('person') || '').toLowerCase().trim();
  const searchParam = (url.searchParams.get('q') || url.searchParams.get('search') || '').toLowerCase().trim();
  const hideTransfers = url.searchParams.get('hideTransfers') === 'true' || url.searchParams.get('hideTransfers') === '1';

  // 1. Carrega base consolidada de 1.846 lançamentos + customizados criados via POST
  const customTxs = await getCustomTransactions();
  const deletedIds = await getDeletedTransactionIds();

  const allTxs = [...customTxs, ...PERSONAL_TRANSACTIONS].filter(t => !deletedIds.has(t.id));

  // 2. Filtros dinâmicos
  const filtered = allTxs.filter((t) => {
    // Data (from/to)
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;

    // Tipo (expense / income)
    if (typeParam && t.type !== typeParam) return false;

    // Moeda (ARS, BRL, USD)
    if (currencyParam && t.currency !== currencyParam) return false;

    // Categoria
    if (categoryParam) {
      const catLower = categoryParam.toLowerCase();
      const matchCat = t.category?.toLowerCase().includes(catLower);
      const matchSub = t.subcategory?.toLowerCase().includes(catLower);
      if (!matchCat && !matchSub) return false;
    }

    // Membro Familiar / Titular / Dependente (Amanda, Gastão, Colégio Misericórdia, etc.)
    if (personParam) {
      const tTag = (t.childTag || '').toLowerCase();
      const pTag = (t.parentTag || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const merc = (t.merchant || '').toLowerCase();
      const id = (t.id || '').toLowerCase();

      let match = false;
      if (tTag.includes(personParam) || pTag.includes(personParam)) {
        match = true;
      } else if (personParam.includes('amanda') && (id.includes('amanda') || desc.includes('amanda') || merc.includes('amanda'))) {
        match = true;
      } else if ((personParam.includes('gast') || personParam === 'junior') && (id.includes('galicia') || desc.includes('gast') || merc.includes('gast') || merc.includes('junior'))) {
        match = true;
      } else if ((personParam.includes('filho') || personParam.includes('misericordia') || personParam.includes('escola')) && 
                 (t.category === 'Filhos & Família' || desc.includes('misericordia') || merc.includes('misericordia'))) {
        match = true;
      }
      if (!match) return false;
    }

    // Ocultar transferências internas entre contas do casal
    if (hideTransfers && t.isInternalTransfer) {
      return false;
    }

    // Busca textual livre
    if (searchParam) {
      const merc = (t.merchant || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      if (!merc.includes(searchParam) && !desc.includes(searchParam) && !cat.includes(searchParam)) {
        return false;
      }
    }

    return true;
  });

  // 3. Ordenação por data descrescente (mais recentes primeiro)
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // 4. Paginação
  const paginated = filtered.slice(offset, offset + limit);

  return {
    status: 200,
    body: {
      data: paginated,
      count: filtered.length,
      total: allTxs.length,
      limit,
      offset,
    },
    resourceType: 'personal_transaction',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = createPersonalTransactionSchema.parse(body);

  const newTx = {
    id: `tx-pf-${Date.now()}`,
    date: parsed.date,
    merchant: parsed.merchant,
    description: parsed.description || parsed.merchant,
    amount: parsed.amount,
    currency: parsed.currency,
    type: parsed.type,
    category: parsed.category,
    subcategory: parsed.subcategory || parsed.category,
    childTag: parsed.childTag || 'Geral',
    language: parsed.language || 'pt',
    isInternalTransfer: false,
  };

  const customTxs = await getCustomTransactions();
  customTxs.unshift(newTx);
  await saveCustomTransactions(customTxs);

  return {
    status: 201,
    body: { data: newTx, message: 'Transação pessoal registrada com sucesso!' },
    resourceType: 'personal_transaction',
    resourceId: newTx.id,
    requestBody: parsed,
    afterData: newTx,
  };
});

export const DELETE = withAgentAuth(async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return {
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: 'Parâmetro "id" é obrigatório.' } },
      resourceType: 'personal_transaction',
    };
  }

  await addDeletedTransactionId(id);

  return {
    status: 200,
    body: { success: true, deletedId: id, message: `Transação ${id} removida com sucesso.` },
    resourceType: 'personal_transaction',
    resourceId: id,
  };
});

import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PERSONAL_TRANSACTIONS } from '@/lib/transactionData';
import { parseBrazilianCurrency } from '@/lib/currency/format';
import { notFound, badRequest } from '../errors';
import fs from 'fs';
import path from 'path';

export type PersonalCurrency = 'BRL' | 'ARS' | 'USD';
export type PersonalType = 'expense' | 'income';

export interface PersonalTransaction {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: PersonalCurrency;
  type: PersonalType;
  category: string;
  subcategory?: string;
  childTag?: string;
  parentTag?: string;
  paymentMethod?: string;
  language?: 'pt' | 'es';
  isInternalTransfer?: boolean;
}

export const CUSTOM_TX_KEY = 'personal_custom_transactions';
export const DELETED_TX_KEY = 'personal_deleted_tx_ids';
export const CUSTOM_CATEGORIES_KEY = 'personal_custom_categories';

export const BUILTIN_IDS = new Set((PERSONAL_TRANSACTIONS || []).map((t: any) => t.id));

export function getTodayBrt(): string {
  const brt = new Date(Date.now() - 3 * 3600 * 1000);
  return brt.toISOString().split('T')[0]!;
}

export function getYesterdayBrt(): string {
  const brt = new Date(Date.now() - 3 * 3600 * 1000 - 24 * 3600 * 1000);
  return brt.toISOString().split('T')[0]!;
}

// ─── PERSISTÊNCIA EM BANCO NEON DB COM FALLBACK LOCAL ───

export async function getPersonalCustomTransactions(): Promise<PersonalTransaction[]> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, CUSTOM_TX_KEY))
      .limit(1);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Personal Service] Falha ao ler custom transactions do banco:', e);
  }

  try {
    const filePath = path.join(process.cwd(), 'data', `${CUSTOM_TX_KEY}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

export async function savePersonalCustomTransactions(list: PersonalTransaction[]): Promise<void> {
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
  } catch (e) {
    console.warn('[Personal Service] Falha ao gravar custom transactions no banco:', e);
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `${CUSTOM_TX_KEY}.json`), jsonStr, 'utf8');
  } catch {}
}

export async function getPersonalDeletedIds(): Promise<Set<string>> {
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

  try {
    const filePath = path.join(process.cwd(), 'data', `${DELETED_TX_KEY}.json`);
    if (fs.existsSync(filePath)) {
      const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {}

  return new Set();
}

export async function addPersonalDeletedIds(ids: string[]): Promise<Set<string>> {
  const deletedSet = await getPersonalDeletedIds();
  ids.forEach(id => deletedSet.add(id));
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
    fs.writeFileSync(path.join(dataDir, `${DELETED_TX_KEY}.json`), jsonStr, 'utf8');
  } catch {}

  return deletedSet;
}

export async function getPersonalCategories(): Promise<any[]> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, CUSTOM_CATEGORIES_KEY))
      .limit(1);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  try {
    const filePath = path.join(process.cwd(), 'data', `${CUSTOM_CATEGORIES_KEY}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

export async function savePersonalCategories(cats: any[]): Promise<void> {
  const jsonStr = JSON.stringify(cats);
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, CUSTOM_CATEGORIES_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(systemSettings)
        .set({ value: jsonStr, updatedAt: new Date() })
        .where(eq(systemSettings.key, CUSTOM_CATEGORIES_KEY));
    } else {
      await db
        .insert(systemSettings)
        .values({ key: CUSTOM_CATEGORIES_KEY, value: jsonStr });
    }
  } catch {}

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `${CUSTOM_CATEGORIES_KEY}.json`), jsonStr, 'utf8');
  } catch {}
}

export function deduplicateTransactions(list: PersonalTransaction[]): PersonalTransaction[] {
  const seenId = new Set<string>();
  const seenSig = new Set<string>();
  const result: PersonalTransaction[] = [];

  for (const tx of list) {
    if (!tx || !tx.id) continue;
    if (seenId.has(tx.id)) continue;

    const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sig = `${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;

    if (seenSig.has(sig)) continue;

    seenId.add(tx.id);
    seenSig.add(sig);
    result.push(tx);
  }

  return result;
}

// ─── NORMALIZAÇÃO ULTRA-RESILIENTE PARA AGENTES DE IA ───

export function normalizeIncomingPersonalTx(raw: any, existingId?: string): PersonalTransaction {
  if (!raw || typeof raw !== 'object') {
    throw badRequest('Dados da transação inválidos ou vazios.');
  }

  // 1. Valor / Amount
  const rawAmount = raw.amount ?? raw.valor ?? raw.price ?? raw.value ?? raw.quantia;
  let finalAmount = parseBrazilianCurrency(rawAmount);

  if (finalAmount <= 0) {
    const num = Number(rawAmount);
    if (!isNaN(num) && num !== 0) {
      finalAmount = Math.abs(num);
    }
  }

  if (finalAmount <= 0) {
    throw badRequest(`Valor da transação inválido ou zerado: "${rawAmount}". Forneça um valor positivo (ex: 150.00 ou "150,00" ou "10.000,00").`);
  }

  finalAmount = Number(finalAmount.toFixed(2));

  // 2. Moeda / Currency
  const rawCurr = String(raw.currency ?? raw.moeda ?? 'BRL').trim().toUpperCase();
  let finalCurrency: PersonalCurrency = 'BRL';
  if (rawCurr.includes('ARS') || rawCurr.includes('PESO')) {
    finalCurrency = 'ARS';
  } else if (rawCurr.includes('USD') || rawCurr.includes('DOLAR') || rawCurr.includes('DÓLAR') || rawCurr === '$') {
    finalCurrency = 'USD';
  } else {
    finalCurrency = 'BRL';
  }

  // 3. Data / Date
  const rawDate = String(raw.date ?? raw.data ?? raw.createdAt ?? raw.dia ?? '').trim().toLowerCase();
  let finalDate = getTodayBrt();

  if (!rawDate || rawDate === 'today' || rawDate === 'hoje' || rawDate === 'now' || rawDate === 'agora') {
    finalDate = getTodayBrt();
  } else if (rawDate === 'yesterday' || rawDate === 'ontem') {
    finalDate = getYesterdayBrt();
  } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(rawDate)) {
    // DD/MM/YYYY ou DD-MM-YYYY
    const parts = rawDate.split(/[\/\-]/);
    finalDate = `${parts[2]}-${parts[1]?.padStart(2, '0')}-${parts[0]?.padStart(2, '0')}`;
  } else if (rawDate.includes('t')) {
    // ISO format
    finalDate = rawDate.split('t')[0]!;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    finalDate = rawDate;
  }

  // 4. Estabelecimento / Merchant
  const rawMerchant = String(
    raw.merchant ??
    raw.estabelecimento ??
    raw.loja ??
    raw.fornecedor ??
    raw.local ??
    raw.nome ??
    raw.description ??
    raw.descricao ??
    raw.title ??
    'Não informado'
  ).trim();

  // 5. Descrição / Description
  const rawDescription = String(
    raw.description ??
    raw.descricao ??
    raw.detalhes ??
    raw.memo ??
    raw.obs ??
    rawMerchant
  ).trim();

  // 6. Tipo / Type (expense ou income)
  const rawType = String(raw.type ?? raw.tipo ?? 'expense').trim().toLowerCase();
  let finalType: PersonalType = 'expense';
  if (['income', 'receita', 'entrada', 'ganho', 'credito', 'salario', 'prolabore'].includes(rawType)) {
    finalType = 'income';
  }

  // 7. Titular / Responsável Familiar (Amanda, Gastão, etc.)
  const rawMember = String(
    raw.childTag ??
    raw.member ??
    raw.person ??
    raw.titular ??
    raw.responsavel ??
    raw.membro ??
    raw.quem ??
    raw.usuario ??
    raw.owner ??
    ''
  ).trim();

  let finalMember = 'Amanda e Gastão';
  const memberLower = rawMember.toLowerCase();
  if (memberLower.includes('amanda')) {
    finalMember = 'Amanda';
  } else if (memberLower.includes('gast') || memberLower.includes('junior')) {
    finalMember = 'Gastão';
  } else if (memberLower.includes('filho') || memberLower.includes('sofia') || memberLower.includes('matheus') || memberLower.includes('misericordia')) {
    finalMember = 'Filhos & Família';
  } else if (rawMember) {
    finalMember = rawMember;
  }

  // 8. Categoria / Category
  let finalCat = String(raw.category ?? raw.categoria ?? '').trim();
  let finalSubcat = String(raw.subcategory ?? raw.subcategoria ?? '').trim();

  if (!finalCat || finalCat.toLowerCase() === 'geral') {
    const textToMatch = `${rawMerchant} ${rawDescription}`.toLowerCase();
    if (/(supermercado|coto|carrefour|dia|mercado|ifood|pedidosya|restaurante|padaria|lanche|comida|hortifruti|feira)/i.test(textToMatch)) {
      finalCat = 'Alimentação & Supermercado';
    } else if (/(uber|cabify|99|combustivel|gasolina|posto|ypf|shell|sube|subte|estacionamento|pedagio)/i.test(textToMatch)) {
      finalCat = 'Transporte & Veículo';
    } else if (/(aluguel|condominio|edesur|luz|energia|aysa|agua|gas|metrogas|internet|fibertel|wifi|software|assinatura)/i.test(textToMatch)) {
      finalCat = 'Moradia & Serviços';
    } else if (/(farmacia|farmacity|droga|medico|remedio|consulta|hospital|osde|prepaga|saude|dentista)/i.test(textToMatch)) {
      finalCat = 'Saúde & Bem-Estar';
    } else if (/(escola|colegio|misericordia|natacao|ballet|futebol|uniforme|brinquedo|bebe)/i.test(textToMatch)) {
      finalCat = 'Filhos & Família';
    } else if (/(netflix|spotify|cinema|show|viagem|hotel|bar|vinho|cerveja|lazer|passeio)/i.test(textToMatch)) {
      finalCat = 'Lazer & Entretenimento';
    } else if (/(zara|roupa|calcado|tenis|vestuario|shopping|mercado livre|amazon|loja)/i.test(textToMatch)) {
      finalCat = 'Compras & Vestuário';
    } else {
      finalCat = 'Geral & Diversos';
    }
  }

  if (!finalSubcat) {
    finalSubcat = finalCat;
  }

  // 9. ID
  const finalId = existingId || raw.id || `tx-pf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 10. Transferência interna
  const isInternal = Boolean(
    raw.isInternalTransfer ||
    /transfer[eê]ncia entre contas|conta pr[oó]pria/i.test(`${rawMerchant} ${rawDescription}`)
  );

  return {
    id: finalId,
    date: finalDate,
    merchant: rawMerchant,
    description: rawDescription,
    amount: finalAmount,
    currency: finalCurrency,
    type: finalType,
    category: finalCat,
    subcategory: finalSubcat,
    childTag: finalMember,
    paymentMethod: raw.paymentMethod ?? raw.metodoPagamento ?? raw.formaPagamento ?? 'Cartão / Pix',
    language: raw.language === 'es' ? 'es' : 'pt',
    isInternalTransfer: isInternal,
  };
}

// ─── SERVIÇOS DE CONSULTA E MUTACÃO ───

export async function listPersonalTransactions(params: {
  from?: string;
  to?: string;
  type?: string;
  currency?: string;
  category?: string;
  person?: string;
  search?: string;
  id?: string;
  hideTransfers?: boolean;
  limit?: number;
  offset?: number;
}) {
  const {
    from,
    to,
    type,
    currency,
    category,
    person,
    search,
    id,
    hideTransfers = false,
    limit = 50,
    offset = 0,
  } = params;

  const customTxs = await getPersonalCustomTransactions();
  const deletedIds = await getPersonalDeletedIds();

  // Customizados sempre sobrepõem e antecedem os estáticos
  const allTxs = deduplicateTransactions([...customTxs, ...(PERSONAL_TRANSACTIONS as any[])]).filter(
    (t) => !deletedIds.has(t.id)
  );

  const filtered = allTxs.filter((t) => {
    if (id && t.id !== id) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (type && t.type !== type) return false;
    if (currency && t.currency !== currency) return false;

    if (category) {
      const catLower = category.toLowerCase();
      const matchCat = t.category?.toLowerCase().includes(catLower);
      const matchSub = t.subcategory?.toLowerCase().includes(catLower);
      if (!matchCat && !matchSub) return false;
    }

    if (person) {
      const pLower = person.toLowerCase().trim();
      const tTag = (t.childTag || '').toLowerCase();
      const pTag = (t.parentTag || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const merc = (t.merchant || '').toLowerCase();
      const txId = (t.id || '').toLowerCase();

      let match = false;
      if (tTag.includes(pLower) || pTag.includes(pLower)) {
        match = true;
      } else if (pLower.includes('amanda') && (txId.includes('amanda') || desc.includes('amanda') || merc.includes('amanda') || tTag.includes('amanda'))) {
        match = true;
      } else if ((pLower.includes('gast') || pLower === 'junior') && (txId.includes('galicia') || desc.includes('gast') || merc.includes('gast') || tTag.includes('gast'))) {
        match = true;
      } else if ((pLower.includes('filho') || pLower.includes('misericordia') || pLower.includes('escola')) && (t.category === 'Filhos & Família' || desc.includes('misericordia') || merc.includes('misericordia'))) {
        match = true;
      }
      if (!match) return false;
    }

    if (hideTransfers && t.isInternalTransfer) {
      return false;
    }

    if (search) {
      const sLower = search.toLowerCase();
      const merc = (t.merchant || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      if (!merc.includes(sLower) && !desc.includes(sLower) && !cat.includes(sLower)) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const paginated = filtered.slice(offset, offset + limit);

  return {
    data: paginated,
    count: filtered.length,
    total: allTxs.length,
    limit,
    offset,
  };
}

export async function getPersonalTransactionDetail(id: string): Promise<PersonalTransaction | null> {
  const deletedIds = await getPersonalDeletedIds();
  if (deletedIds.has(id)) return null;

  const customTxs = await getPersonalCustomTransactions();
  const foundCustom = customTxs.find((t) => t.id === id);
  if (foundCustom) return foundCustom;

  const foundBuiltin = (PERSONAL_TRANSACTIONS as PersonalTransaction[]).find((t) => t.id === id);
  return foundBuiltin || null;
}

export async function createPersonalTransactionsService(input: any): Promise<{
  transactions: PersonalTransaction[];
  count: number;
  message: string;
}> {
  let itemsToProcess: any[] = [];

  if (Array.isArray(input)) {
    itemsToProcess = input;
  } else if (input && Array.isArray(input.transactions)) {
    itemsToProcess = input.transactions;
  } else if (input && input.transaction && typeof input.transaction === 'object') {
    itemsToProcess = [input.transaction];
  } else if (input && typeof input === 'object') {
    itemsToProcess = [input];
  }

  if (itemsToProcess.length === 0) {
    throw badRequest('Nenhuma transação fornecida no corpo da requisição.');
  }

  const normalizedList: PersonalTransaction[] = itemsToProcess.map((item) =>
    normalizeIncomingPersonalTx(item)
  );

  const customTxs = await getPersonalCustomTransactions();
  const merged = deduplicateTransactions([...normalizedList, ...customTxs]);

  await savePersonalCustomTransactions(merged);

  return {
    transactions: normalizedList,
    count: normalizedList.length,
    message: `${normalizedList.length} transação(ões) pessoal(is) registrada(s) com sucesso na nuvem familiar.`,
  };
}

export async function updatePersonalTransactionService(
  id: string,
  updates: any
): Promise<{
  before: PersonalTransaction;
  after: PersonalTransaction;
}> {
  if (!id) throw badRequest('ID da transação é obrigatório.');

  const existing = await getPersonalTransactionDetail(id);
  if (!existing) {
    throw notFound(`Transação pessoal ${id}`);
  }

  // Mescla o registro existente com os novos dados informados
  const mergedPayload = {
    ...existing,
    ...updates,
    id, // preserva o mesmo ID
  };

  const normalized = normalizeIncomingPersonalTx(mergedPayload, id);

  const customTxs = await getPersonalCustomTransactions();
  let found = false;
  const updatedList = customTxs.map((t) => {
    if (t.id === id) {
      found = true;
      return normalized;
    }
    return t;
  });

  if (!found) {
    updatedList.unshift(normalized);
  }

  const clean = deduplicateTransactions(updatedList);
  await savePersonalCustomTransactions(clean);

  return {
    before: existing,
    after: normalized,
  };
}

export async function deletePersonalTransactionsService(ids: string[]): Promise<{
  deletedIds: string[];
  count: number;
  message: string;
}> {
  const cleanIds = ids.filter(Boolean);
  if (cleanIds.length === 0) {
    throw badRequest('Nenhum ID fornecido para exclusão.');
  }

  await addPersonalDeletedIds(cleanIds);

  const customTxs = await getPersonalCustomTransactions();
  const deletedSet = new Set(cleanIds);
  const remaining = customTxs.filter((t) => !deletedSet.has(t.id));

  await savePersonalCustomTransactions(remaining);

  return {
    deletedIds: cleanIds,
    count: cleanIds.length,
    message: `${cleanIds.length} transação(ões) excluída(s) com sucesso.`,
  };
}

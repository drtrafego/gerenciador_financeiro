import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db/queries';
import { PERSONAL_TRANSACTIONS } from '@/lib/transactionData';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CUSTOM_TX_KEY = 'personal_custom_transactions';
const DELETED_TX_KEY = 'personal_deleted_tx_ids';
const CUSTOM_CATEGORIES_KEY = 'personal_custom_categories';

// Set de IDs das 1.846 transações estáticas built-in para separar dados do sistema de dados criados pelos usuários
const BUILTIN_IDS = new Set((PERSONAL_TRANSACTIONS || []).map((t: any) => t.id));

async function getStoredList(key: string): Promise<any[]> {
  try {
    const val = await getSetting(key);
    if (val) {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(`[Personal API] Erro ao ler ${key} do Neon DB:`, e);
  }

  // Fallback para arquivo local se banco falhar temporariamente
  try {
    const filePath = path.join(process.cwd(), 'data', `${key}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

async function saveStoredList(key: string, list: any[]) {
  const jsonStr = JSON.stringify(list);
  try {
    await setSetting(key, jsonStr);
  } catch (e) {
    console.warn(`[Personal API] Erro ao gravar ${key} no Neon DB:`, e);
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `${key}.json`), jsonStr, 'utf8');
  } catch {}
}

function deduplicateTransactions(list: any[]): any[] {
  const seenId = new Set<string>();
  const seenSignature = new Set<string>();
  const clean: any[] = [];

  for (const tx of list) {
    if (!tx || !tx.id) continue;
    if (seenId.has(tx.id)) continue;

    const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const sig = `${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;

    if (seenSignature.has(sig)) continue;

    seenId.add(tx.id);
    seenSignature.add(sig);
    clean.push(tx);
  }
  return clean;
}

export async function GET() {
  try {
    const [customTransactions, deletedIdsArr, categories] = await Promise.all([
      getStoredList(CUSTOM_TX_KEY),
      getStoredList(DELETED_TX_KEY),
      getStoredList(CUSTOM_CATEGORIES_KEY)
    ]);

    const deletedSet = new Set(deletedIdsArr);
    const validCustom = customTransactions.filter((t: any) => !deletedSet.has(t.id));

    return NextResponse.json({
      success: true,
      customTransactions: validCustom,
      deletedIds: deletedIdsArr,
      categories: categories.length > 0 ? categories : null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    const [currentCustom, currentDeleted, currentCategories] = await Promise.all([
      getStoredList(CUSTOM_TX_KEY),
      getStoredList(DELETED_TX_KEY),
      getStoredList(CUSTOM_CATEGORIES_KEY)
    ]);

    const deletedSet = new Set(currentDeleted);

    if (action === 'sync') {
      const localTxs = Array.isArray(body.localTransactions) ? body.localTransactions : [];
      // Extrai apenas transações que NÃO são o histórico embutido e que não estão na lista de deletados
      const clientCustomTxs = localTxs.filter((t: any) => t && t.id && !BUILTIN_IDS.has(t.id) && !deletedSet.has(t.id));

      // Combina as transações que o cliente tinha localmente com as já persistidas no Neon DB (ex: lançamentos de Amanda e Gastão juntos)
      const combined = [...clientCustomTxs, ...currentCustom].filter((t: any) => !deletedSet.has(t.id));
      const mergedCustom = deduplicateTransactions(combined);

      await saveStoredList(CUSTOM_TX_KEY, mergedCustom);

      // Sincroniza categorias se fornecidas
      let mergedCategories = currentCategories;
      if (Array.isArray(body.localCategories) && body.localCategories.length > 0) {
        if (currentCategories.length === 0) {
          mergedCategories = body.localCategories;
          await saveStoredList(CUSTOM_CATEGORIES_KEY, mergedCategories);
        }
      }

      return NextResponse.json({
        success: true,
        customTransactions: mergedCustom,
        deletedIds: currentDeleted,
        categories: mergedCategories
      });
    }

    if (action === 'add' || action === 'save') {
      const newItems = Array.isArray(body.transactions) 
        ? body.transactions 
        : body.transaction ? [body.transaction] : [];

      const validNew = newItems.filter((t: any) => t && t.id && !deletedSet.has(t.id));
      const combined = [...validNew, ...currentCustom];
      const mergedCustom = deduplicateTransactions(combined);

      await saveStoredList(CUSTOM_TX_KEY, mergedCustom);

      return NextResponse.json({
        success: true,
        customTransactions: mergedCustom
      });
    }

    if (action === 'update') {
      const updatedItem = body.transaction;
      if (!updatedItem?.id) {
        return NextResponse.json({ success: false, error: 'ID obrigatório para atualização' }, { status: 400 });
      }

      let found = false;
      const updatedList = currentCustom.map((t: any) => {
        if (t.id === updatedItem.id) {
          found = true;
          return { ...t, ...updatedItem };
        }
        return t;
      });

      if (!found) {
        updatedList.unshift(updatedItem);
      }

      const clean = deduplicateTransactions(updatedList);
      await saveStoredList(CUSTOM_TX_KEY, clean);

      return NextResponse.json({
        success: true,
        customTransactions: clean
      });
    }

    if (action === 'delete') {
      const idToDelete = body.id;
      const idsToDelete = Array.isArray(body.ids) ? body.ids : (idToDelete ? [idToDelete] : []);

      for (const id of idsToDelete) {
        deletedSet.add(id);
      }

      const updatedDeleted = Array.from(deletedSet);
      const remainingCustom = currentCustom.filter((t: any) => !deletedSet.has(t.id));

      await Promise.all([
        saveStoredList(CUSTOM_TX_KEY, remainingCustom),
        saveStoredList(DELETED_TX_KEY, updatedDeleted)
      ]);

      return NextResponse.json({
        success: true,
        customTransactions: remainingCustom,
        deletedIds: updatedDeleted
      });
    }

    if (action === 'save_categories') {
      const newCats = Array.isArray(body.categories) ? body.categories : [];
      await saveStoredList(CUSTOM_CATEGORIES_KEY, newCats);
      return NextResponse.json({
        success: true,
        categories: newCats
      });
    }

    return NextResponse.json({ success: false, error: 'Ação desconhecida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

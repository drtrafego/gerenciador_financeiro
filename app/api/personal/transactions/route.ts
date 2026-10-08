import { NextResponse } from 'next/server';
import {
  getPersonalCustomTransactions,
  savePersonalCustomTransactions,
  getPersonalDeletedIds,
  addPersonalDeletedIds,
  getPersonalCategories,
  savePersonalCategories,
  deduplicateTransactions,
  normalizeIncomingPersonalTx,
  BUILTIN_IDS,
} from '@/lib/agent/services/personalTransactions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [customTransactions, deletedSet, categories] = await Promise.all([
      getPersonalCustomTransactions(),
      getPersonalDeletedIds(),
      getPersonalCategories(),
    ]);

    const validCustom = customTransactions.filter((t: any) => !deletedSet.has(t.id));
    const deletedArr = Array.from(deletedSet);

    return NextResponse.json({
      success: true,
      customTransactions: validCustom,
      deletedIds: deletedArr,
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

    const [currentCustom, currentDeletedSet, currentCategories] = await Promise.all([
      getPersonalCustomTransactions(),
      getPersonalDeletedIds(),
      getPersonalCategories(),
    ]);

    if (action === 'sync') {
      const localTxs = Array.isArray(body.localTransactions) ? body.localTransactions : [];

      // Filtra os lançamentos que o cliente tem localmente que não são o histórico original intocado
      const clientCustomTxs = localTxs.filter((t: any) => {
        if (!t || !t.id) return false;
        if (currentDeletedSet.has(t.id)) return false;
        // Se for id customizado (gerado pelo usuário/Amanda/Gastão), preserva 100%
        if (!BUILTIN_IDS.has(t.id)) return true;
        return false;
      });

      // Combina os dados trazidos pelo dispositivo com os dados que já estavam na nuvem
      const combined = [...clientCustomTxs, ...currentCustom].filter((t: any) => !currentDeletedSet.has(t.id));
      const mergedCustom = deduplicateTransactions(combined);

      await savePersonalCustomTransactions(mergedCustom);

      // Sincroniza categorias se fornecidas pelo cliente
      let mergedCategories = currentCategories;
      if (Array.isArray(body.localCategories) && body.localCategories.length > 0) {
        if (currentCategories.length === 0) {
          mergedCategories = body.localCategories;
          await savePersonalCategories(mergedCategories);
        }
      }

      return NextResponse.json({
        success: true,
        customTransactions: mergedCustom,
        deletedIds: Array.from(currentDeletedSet),
        categories: mergedCategories,
      });
    }

    if (action === 'add' || action === 'save') {
      const newItems = Array.isArray(body.transactions)
        ? body.transactions
        : body.transaction ? [body.transaction] : [];

      const validNew = newItems
        .filter((t: any) => t && t.id && !currentDeletedSet.has(t.id))
        .map((t: any) => normalizeIncomingPersonalTx(t));

      const combined = [...validNew, ...currentCustom];
      const mergedCustom = deduplicateTransactions(combined);

      await savePersonalCustomTransactions(mergedCustom);

      return NextResponse.json({
        success: true,
        customTransactions: mergedCustom,
      });
    }

    if (action === 'update') {
      const updatedItem = body.transaction;
      if (!updatedItem?.id) {
        return NextResponse.json({ success: false, error: 'ID obrigatório para atualização' }, { status: 400 });
      }

      const normalized = normalizeIncomingPersonalTx(updatedItem, updatedItem.id);

      let found = false;
      const updatedList = currentCustom.map((t: any) => {
        if (t.id === normalized.id) {
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

      return NextResponse.json({
        success: true,
        customTransactions: clean,
      });
    }

    if (action === 'delete') {
      const idToDelete = body.id;
      const idsToDelete: string[] = Array.isArray(body.ids)
        ? body.ids
        : idToDelete ? [idToDelete] : [];

      await addPersonalDeletedIds(idsToDelete);

      const updatedDeletedSet = await getPersonalDeletedIds();
      const remainingCustom = currentCustom.filter((t: any) => !updatedDeletedSet.has(t.id));

      await savePersonalCustomTransactions(remainingCustom);

      return NextResponse.json({
        success: true,
        customTransactions: remainingCustom,
        deletedIds: Array.from(updatedDeletedSet),
      });
    }

    if (action === 'save_categories') {
      const newCats = Array.isArray(body.categories) ? body.categories : [];
      await savePersonalCategories(newCats);
      return NextResponse.json({
        success: true,
        categories: newCats,
      });
    }

    return NextResponse.json({ success: false, error: 'Ação desconhecida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

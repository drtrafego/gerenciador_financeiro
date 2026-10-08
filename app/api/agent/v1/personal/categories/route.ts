import { withAgentAuth } from '@/lib/agent/route';
import {
  getPersonalCategories,
  savePersonalCategories,
} from '@/lib/agent/services/personalTransactions';
import { parseBrazilianCurrency } from '@/lib/currency/format';

const DEFAULT_CATEGORIES = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", subcategories: ["Escola / Colegiatura", "Natação & Esportes", "Vestuário Infantil", "Brinquedos"], limit: 3500, color: "bg-pink-500/20 text-pink-400 border-pink-500/30", emoji: "👦" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", subcategories: ["Supermercado (Coto / Carrefour)", "Feira & Orgânicos", "Restaurantes & Delivery (iFood/PedidosYa)"], limit: 4500, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "🍕" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", subcategories: ["Uber / Cabify", "Oficina & Manutenção", "Transporte Público (SUBE/Subte)", "Combustível & Estacionamento"], limit: 1800, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", emoji: "🚗" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", subcategories: ["Aluguel / Condomínio", "Energia (Edesur/Luz)", "Gás & Água", "Internet & Wifi", "Assinaturas & Software"], limit: 5000, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🏠" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", subcategories: ["Plano de Saúde (Prepaga/OSDE)", "Farmácia (Farmacity)", "Consultas & Exames", "Academia & Esportes"], limit: 2500, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", emoji: "💊" },
  { id: "cat-shopping", namePt: "Compras & Vestuário", nameEs: "Compras y Vestuario", subcategories: ["Roupas & Calçados", "Eletrônicos & Casa", "Compras Gerais (Mercado Livre)"], limit: 3000, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", emoji: "🛍️" },
  { id: "cat-transfers", namePt: "Transferências & Outros", nameEs: "Transferencias y Otros", subcategories: ["Transferências Gerais", "Taxas & Tarifas"], limit: 10000, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", emoji: "💸" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", subcategories: ["Passeios em Família", "Cinema & Shows", "Assinaturas (Netflix/Spotify)", "Viagens", "Vinho"], limit: 2000, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", emoji: "🥳" },
  { id: "cat-general", namePt: "Geral & Diversos", nameEs: "General y Diversos", subcategories: ["Despesas Gerais", "Lançamentos Históricos", "Não Identificados"], limit: 5000, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", emoji: "📦" },
];

export const GET = withAgentAuth(async () => {
  const custom = await getPersonalCategories();
  const list = custom.length > 0 ? custom : DEFAULT_CATEGORIES;

  return {
    status: 200,
    body: {
      data: list,
      count: list.length,
    },
    resourceType: 'personal_categories',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();

  const namePt = body.namePt || body.nome || body.name || 'Nova Categoria';
  const nameEs = body.nameEs || namePt;
  const rawLimit = body.limit ?? body.limite ?? body.budget ?? body.teto;
  const limit = parseBrazilianCurrency(rawLimit) || 1000;

  const current = await getPersonalCategories();
  const baseList = current.length > 0 ? current : DEFAULT_CATEGORIES;

  const newCategory = {
    id: body.id || `custom-cat-${Date.now()}`,
    namePt,
    nameEs,
    limit,
    emoji: body.emoji || "📂",
    color: body.color || "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    subcategories: Array.isArray(body.subcategories) ? body.subcategories : ["Geral"],
  };

  const updatedList = [
    ...baseList.filter((c: any) => c.namePt !== namePt && c.id !== newCategory.id),
    newCategory,
  ];

  await savePersonalCategories(updatedList);

  return {
    status: 201,
    body: {
      data: newCategory,
      categories: updatedList,
      message: `Categoria pessoal "${namePt}" salva com sucesso!`,
    },
    resourceType: 'personal_categories',
    requestBody: body,
  };
});

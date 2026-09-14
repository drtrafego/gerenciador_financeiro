import { withAgentAuth } from '@/lib/agent/route';
import { z } from 'zod';

const createCategorySchema = z.object({
  namePt: z.string().min(1),
  nameEs: z.string().optional(),
  limit: z.number().positive(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  subcategories: z.array(z.string()).optional(),
});

const DEFAULT_CATEGORIES = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", subcategories: ["Escola / Colegiatura", "Natação & Esportes", "Vestuário Infantil"], limit: 3500, color: "bg-pink-500/20 text-pink-400 border-pink-500/30", emoji: "👦" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", subcategories: ["Supermercado (Coto / Carrefour)", "Restaurantes & Delivery"], limit: 4500, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "🍕" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", subcategories: ["Passeios em Família", "Cinema & Shows", "Assinaturas"], limit: 2000, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", emoji: "🥳" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", subcategories: ["Aluguel / Condomínio", "Energia (Edesur/Luz)", "Gás & Água"], limit: 5000, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🏠" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", subcategories: ["Plano de Saúde (OSDE)", "Farmácia (Farmacity)"], limit: 2500, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", emoji: "💊" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", subcategories: ["Combustível (YPF/Shell)", "Uber / Cabify"], limit: 1800, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", emoji: "🚗" },
];

export const GET = withAgentAuth(async () => {
  return {
    status: 200,
    body: {
      data: DEFAULT_CATEGORIES,
      count: DEFAULT_CATEGORIES.length,
    },
    resourceType: 'personal_categories',
  };
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = createCategorySchema.parse(body);

  const newCategory = {
    id: `custom-cat-${Date.now()}`,
    namePt: parsed.namePt,
    nameEs: parsed.nameEs || parsed.namePt,
    limit: parsed.limit,
    emoji: parsed.emoji || "📂",
    color: parsed.color || "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    subcategories: parsed.subcategories || ["Geral"],
  };

  return {
    status: 201,
    body: {
      data: newCategory,
      message: `Categoria pessoal ${parsed.namePt} criada com sucesso!`,
    },
    resourceType: 'personal_categories',
    requestBody: parsed,
  };
});

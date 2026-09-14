'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { DICTIONARY } from '@/lib/i18n/dict';
import { 
  PieChart as PieIcon, 
  Baby, 
  Utensils, 
  Sparkles, 
  Home, 
  HeartPulse, 
  Car,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Check,
  ShoppingBag,
  Briefcase,
  Plane,
  GraduationCap
} from 'lucide-react';

interface CustomCategory {
  id: string;
  namePt: string;
  nameEs: string;
  subcategories: string[];
  limit: number;
  spent: number;
  color: string;
}

const INITIAL_CATEGORIES: CustomCategory[] = [
  { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", subcategories: ["Escola / Colegiatura", "Natação & Esportes", "Vestuário Infantil", "Brinquedos"], limit: 3500, spent: 2850, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", subcategories: ["Supermercado (Coto / Carrefour)", "Feira & Orgânicos", "Restaurantes & Delivery (iFood/PedidosYa)"], limit: 4500, spent: 3420, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "cat-leisure", namePt: "Lazer & Entretenimento", nameEs: "Ocio y Entretenimiento", subcategories: ["Passeios em Família", "Cinema & Shows", "Assinaturas (Netflix/Spotify)", "Viagens"], limit: 2000, spent: 1200, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "cat-housing", namePt: "Moradia & Serviços", nameEs: "Vivienda y Servicios", subcategories: ["Aluguel / Condomínio", "Energia (Edesur/Luz)", "Gás & Água", "Internet & Wifi"], limit: 5000, spent: 4100, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "cat-health", namePt: "Saúde & Bem-Estar", nameEs: "Salud y Bienestar", subcategories: ["Plano de Saúde (Prepaga/OSDE)", "Farmácia (Farmacity)", "Consultas & Exames"], limit: 2500, spent: 1840, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  { id: "cat-transport", namePt: "Transporte & Veículo", nameEs: "Transporte y Vehículo", subcategories: ["Combustível (YPF/Shell)", "Uber / Cabify", "Manutenção Veicular", "Seguro Auto"], limit: 1800, spent: 1450, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
];

export default function PersonalCategoriesPage() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [categories, setCategories] = useState<CustomCategory[]>(INITIAL_CATEGORIES);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New/Edit Category Form State
  const [namePt, setNamePt] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [limit, setLimit] = useState<number>(1000);
  const [subcategoriesInput, setSubcategoriesInput] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('personal_custom_categories');
    if (stored) {
      try {
        setCategories(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const saveToStorage = (updated: CustomCategory[]) => {
    setCategories(updated);
    localStorage.setItem('personal_custom_categories', JSON.stringify(updated));
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setNamePt('');
    setNameEs('');
    setLimit(1500);
    setSubcategoriesInput('');
    setShowModal(true);
  };

  const handleOpenEditModal = (cat: CustomCategory) => {
    setEditingId(cat.id);
    setNamePt(cat.namePt);
    setNameEs(cat.nameEs);
    setLimit(cat.limit);
    setSubcategoriesInput(cat.subcategories.join(', '));
    setShowModal(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();

    const subcats = subcategoriesInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (editingId) {
      const updated = categories.map(c => 
        c.id === editingId 
          ? { ...c, namePt, nameEs: nameEs || namePt, limit, subcategories: subcats }
          : c
      );
      saveToStorage(updated);
    } else {
      const newCat: CustomCategory = {
        id: `custom-cat-${Date.now()}`,
        namePt,
        nameEs: nameEs || namePt,
        subcategories: subcats.length ? subcats : ["Geral"],
        limit,
        spent: 0,
        color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
      };
      saveToStorage([...categories, newCat]);
    }

    setShowModal(false);
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta categoria pessoal?")) {
      const updated = categories.filter(c => c.id !== id);
      saveToStorage(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <PieIcon className="w-6 h-6 text-indigo-400" />
            {dict.categories.title}
          </h2>
          <p className="text-sm text-zinc-400">
            Personalize suas categorias de gastos pessoais, defina limites mensais e adicione subcategorias
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Criar Nova Categoria Pessoal</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const name = lang === 'pt' ? cat.namePt : cat.nameEs;
          const percentUsed = Math.min(Math.round((cat.spent / cat.limit) * 100), 100);

          return (
            <div key={cat.id} className="p-5 rounded-2xl border border-zinc-800 space-y-4 bg-zinc-900/60 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${cat.color}`}>
                      <PieIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{name}</h3>
                      <p className="text-xs text-zinc-400">
                        Meta Mensal: <strong className="text-zinc-200">R$ {cat.limit.toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      title="Editar limite/subcategorias"
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      title="Excluir categoria"
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentUsed > 80
                          ? 'bg-gradient-to-r from-rose-500 to-red-600'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                      }`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-zinc-400 font-mono">
                    <span>R$ {cat.spent.toLocaleString()} {dict.categories.spentOfLimit}</span>
                    <span className="font-bold text-zinc-200">{percentUsed}%</span>
                  </div>
                </div>

                {/* Subcategories tags */}
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-zinc-800/60">
                    <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Subcategorias:</p>
                    <div className="flex flex-wrap gap-1">
                      {cat.subcategories.map((sub, idx) => (
                        <span key={idx} className="text-[10px] bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700/50">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {percentUsed > 80 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Atenção: Você atingiu {percentUsed}% do limite mensal nesta categoria.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Criar / Editar Categoria */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl border border-zinc-800 w-full max-w-md bg-zinc-900 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-400" />
              {editingId ? "Editar Categoria Pessoal" : "Criar Nova Categoria Pessoal"}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Nome em Português 🇧🇷</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hobbies & Esportes, Viagens, Manutenção da Casa"
                  value={namePt}
                  onChange={(e) => setNamePt(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Nome em Espanhol 🇦🇷 (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Ocio, Deportes, Viajes"
                  value={nameEs}
                  onChange={(e) => setNameEs(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Limite de Gasto Mensal (R$ / BRL)</label>
                <input
                  type="number"
                  required
                  step="50"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Subcategorias (separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Futebol, Cinema, Assinaturas, Livros"
                  value={subcategoriesInput}
                  onChange={(e) => setSubcategoriesInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
                <p className="text-[11px] text-zinc-500">Ajuda a categorizar subitens detalhados das despesas.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Salvar Categoria</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

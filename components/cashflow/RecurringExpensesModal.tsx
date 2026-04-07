"use client";

import { useState, useTransition } from "react";
import { X, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createRecurringExpenseAction,
  toggleRecurringExpenseAction,
  deleteRecurringExpenseAction,
} from "@/server/actions/recurringExpenses";

type RecurringExpense = {
  id: string;
  name: string;
  category: string;
  amount: string;
  currency: string | null;
  dayOfMonth: number | null;
  active: string | null;
};

const CATEGORIES = ["Ferramentas", "Imposto", "Salário", "Contador", "Aluguel", "Assinatura", "Marketing", "Outros"];

const inputClass =
  "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full";

export default function RecurringExpensesModal({
  onClose,
  expenses,
}: {
  onClose: () => void;
  expenses: RecurringExpense[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createRecurringExpenseAction(fd);
      router.refresh();
      setShowForm(false);
    });
  };

  const handleToggle = (id: string, currentActive: string | null) => {
    startTransition(async () => {
      await toggleRecurringExpenseAction(id, currentActive !== 'true');
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteRecurringExpenseAction(id);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Custos Recorrentes</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Aparecem automaticamente no fluxo todo mês</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
          {expenses.length === 0 && !showForm && (
            <p className="text-center text-sm text-zinc-600 py-6">Nenhum custo recorrente cadastrado</p>
          )}
          {expenses.map((exp) => {
            const isActive = exp.active === 'true';
            return (
              <div
                key={exp.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  isActive ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-800 bg-zinc-900 opacity-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-200 truncate">{exp.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {exp.category} · dia {exp.dayOfMonth ?? 1} · {exp.currency ?? "BRL"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-400 shrink-0">
                  -{Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(exp.id, exp.active)}
                    disabled={isPending}
                    className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                    title={isActive ? "Desativar" : "Ativar"}
                  >
                    {isActive ? <ToggleRight size={18} className="text-indigo-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    disabled={isPending}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Formulário inline */}
          {showForm && (
            <form
              onSubmit={handleCreate}
              className="border border-indigo-500/40 bg-zinc-800/60 rounded-xl p-4 flex flex-col gap-3 mt-1"
            >
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Novo custo recorrente</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input name="name" required placeholder="Nome (ex: Adobe CC)" className={inputClass} />
                </div>
                <div>
                  <select name="category" required className={inputClass}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <select name="currency" defaultValue="BRL" className={inputClass}>
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Valor"
                    className={inputClass}
                  />
                </div>
                <div>
                  <input
                    name="dayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="1"
                    placeholder="Dia do mês"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 shrink-0">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 text-sm transition-colors"
            >
              <Plus size={14} />
              Adicionar custo recorrente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

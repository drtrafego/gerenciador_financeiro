"use client";

import { useState, useTransition } from "react";
import { X, Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  toggleRecurringExpenseAction,
  deleteRecurringExpenseAction,
} from "@/server/actions/recurringExpenses";

type RecurringExpense = {
  id: string;
  name: string;
  category: string;
  amount: string;
  baseAmount?: string | null;
  iof?: boolean | null;
  currency: string | null;
  dayOfMonth: number | null;
  active: string | null;
};

const CATEGORIES = ["Ferramentas", "Imposto", "Salário", "Contador", "Aluguel", "Assinatura", "Marketing", "Outros"];

const inputClass =
  "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full";

const EMPTY_FORM = {
  name: "",
  category: CATEGORIES[0],
  amount: "",
  currency: "BRL",
  dayOfMonth: "1",
  iof: false,
};

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const IOF_RATE = 0.0338;

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (exp: RecurringExpense) => {
    setForm({
      name: exp.name,
      category: exp.category,
      // mostra o valor original (base); cai no amount em registros antigos sem base
      amount: exp.baseAmount ? String(Number(exp.baseAmount)) : String(Number(exp.amount)),
      currency: exp.currency ?? "BRL",
      dayOfMonth: String(exp.dayOfMonth ?? 1),
      iof: exp.iof === true,
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("category", form.category);
    fd.set("amount", form.amount); // valor base original; o IOF é aplicado no server
    fd.set("currency", form.currency);
    fd.set("dayOfMonth", form.dayOfMonth);
    fd.set("iof", form.currency === "USD" && form.iof ? "true" : "false");

    startTransition(async () => {
      if (editingId) {
        await updateRecurringExpenseAction(editingId, fd);
      } else {
        await createRecurringExpenseAction(fd);
      }
      router.refresh();
      closeForm();
    });
  };

  const handleToggle = (id: string, currentActive: string | null) => {
    startTransition(async () => {
      await toggleRecurringExpenseAction(id, currentActive !== "true");
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteRecurringExpenseAction(id);
      router.refresh();
    });
  };

  const showIofRow = form.currency === "USD";

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
            const isActive = exp.active === "true";
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
                    {exp.iof === true && <span className="text-amber-400/80"> · IOF</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-400 shrink-0">
                  -{Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(exp)}
                    disabled={isPending}
                    className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
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

          {/* Formulário inline (criar ou editar) */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="border border-indigo-500/40 bg-zinc-800/60 rounded-xl p-4 flex flex-col gap-3 mt-1"
            >
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                {editingId ? "Editar custo recorrente" : "Novo custo recorrente"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    required
                    placeholder="Nome (ex: Adobe CC)"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <select
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    required
                    className={inputClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value, iof: e.target.value === "USD" ? f.iof : false }))
                    }
                    className={inputClass}
                  >
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Valor"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                    className={inputClass}
                  />
                </div>
                {/* IOF — só aparece quando USD selecionado. Não altera o valor digitado. */}
                {showIofRow && (
                  <div className="col-span-2 flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-amber-400">IOF — Cartão Internacional</p>
                      {form.iof && form.amount ? (
                        <p className="text-[10px] text-amber-300/70 mt-0.5">
                          USD {parseFloat(form.amount).toFixed(2)} + IOF = USD{" "}
                          {(parseFloat(form.amount) * (1 + IOF_RATE)).toFixed(2)} (3,38%)
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-300/50 mt-0.5">3,38% sobre o valor em dólar</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setField("iof", !form.iof)}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                        form.iof ? "bg-amber-500" : "bg-zinc-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                          form.iof ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}
                <div>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Dia do mês"
                    value={form.dayOfMonth}
                    onChange={(e) => setField("dayOfMonth", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeForm}
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
              onClick={openNew}
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

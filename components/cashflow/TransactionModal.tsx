"use client";

import { useState } from "react";
import { X, RefreshCw, Trash2, PauseCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createTransaction,
  updateTransaction,
  deactivateRecurring,
  deleteTransactionById,
} from "@/server/actions/transactions";

const CATEGORIES = {
  income:  ["Mensalidade", "Projeto", "Consultoria", "Outros"],
  expense: ["Ferramentas", "Imposto", "Salário", "Contador", "Aluguel", "Assinatura", "Marketing", "Outros"],
};

const inputClass =
  "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full";

type TransactionData = {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: string | null;
  currency: string | null;
  date: string;
  isRecurring: string | null;
  recurringActive: string | null;
  recurringEndsAt: string | null;
};

interface Props {
  onClose: () => void;
  transaction?: TransactionData;
}

export default function TransactionModal({ onClose, transaction }: Props) {
  const router = useRouter();
  const isEdit = !!transaction;

  const [type, setType] = useState<"income" | "expense">(
    (transaction?.type as "income" | "expense") ?? "expense"
  );
  const [category, setCategory] = useState(transaction?.category ?? CATEGORIES.expense[0]);
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(
    transaction?.amount ? String(Number(transaction.amount)) : ""
  );
  const [currency, setCurrency] = useState(transaction?.currency ?? "BRL");
  const [date, setDate] = useState(
    transaction?.date ?? new Date().toISOString().split("T")[0]
  );

  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring === "true");
  const [periodType, setPeriodType] = useState<"forever" | "months">(
    transaction?.recurringEndsAt ? "months" : "forever"
  );
  const [months, setMonths] = useState(() => {
    if (transaction?.date && transaction?.recurringEndsAt) {
      const start = new Date(transaction.date + "T12:00:00");
      const end = new Date(transaction.recurringEndsAt + "T12:00:00");
      const diff =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      return String(Math.max(1, diff));
    }
    return "6";
  });

  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const computeEndsAt = (): string | null => {
    if (!isRecurring || periodType === "forever") return null;
    const start = new Date(date + "T12:00:00");
    start.setMonth(start.getMonth() + parseInt(months || "1", 10));
    return start.toISOString().split("T")[0]!;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) return;
    setLoading(true);
    const data = {
      type,
      category,
      description,
      amount: parseFloat(amount),
      currency: currency as "BRL" | "USD" | "ARS",
      date,
      isRecurring,
      recurringEndsAt: computeEndsAt(),
    };
    try {
      if (isEdit && transaction) {
        await updateTransaction(transaction.id, data);
      } else {
        await createTransaction(data);
      }
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      await deactivateRecurring(transaction.id);
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      await deleteTransactionById(transaction.id);
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isDeactivated = transaction?.recurringActive === "false";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              {isEdit ? "Editar Lançamento" : "Novo Lançamento"}
            </h3>
            {isEdit && transaction?.isRecurring === "true" && (
              <p className="text-xs text-orange-400 mt-0.5 flex items-center gap-1">
                <RefreshCw size={10} />
                {isDeactivated ? "Recorrente desativado" : "Lançamento recorrente"}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Tipo */}
          <div className="flex gap-2">
            {(["income", "expense"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategory(CATEGORIES[t][0]);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all
                  ${type === t
                    ? t === "income"
                      ? "border-green-500 bg-green-500/10 text-green-400"
                      : "border-red-500 bg-red-500/10 text-red-400"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}
              >
                {t === "income" ? "↑ Entrada" : "↓ Saída"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Valor *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="0,00"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Moeda</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES[type].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Data *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Descrição *</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Ex: Assinatura Adobe CC"
              required
            />
          </div>

          {/* Recorrência */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsRecurring((v) => !v)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <RefreshCw size={14} className={isRecurring ? "text-orange-400" : "text-zinc-500"} />
                Lançamento recorrente
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${isRecurring ? "bg-orange-500" : "bg-zinc-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isRecurring ? "left-5" : "left-0.5"}`} />
              </div>
            </button>

            {isRecurring && (
              <div className="flex flex-col gap-3 pt-1 border-t border-zinc-700">
                <p className="text-xs text-zinc-500">Aparece automaticamente no fluxo de caixa todo mês</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriodType("forever")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      periodType === "forever"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                    }`}
                  >
                    Para sempre
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodType("months")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      periodType === "months"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                    }`}
                  >
                    Por período
                  </button>
                </div>

                {periodType === "months" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 w-24 text-center"
                    />
                    <span className="text-sm text-zinc-400">meses</span>
                    {date && months && (
                      <span className="text-xs text-zinc-500 ml-auto">
                        até{" "}
                        {(() => {
                          const d = new Date(date + "T12:00:00");
                          d.setMonth(d.getMonth() + parseInt(months || "1", 10));
                          return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
                        })()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Lançar"}
            </button>
          </div>

          {/* Ações extras no modo edição */}
          {isEdit && (
            <div className="flex gap-2 border-t border-zinc-800 pt-3">
              {transaction?.isRecurring === "true" && !isDeactivated && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
                >
                  <PauseCircle size={12} />
                  Parar recorrência
                </button>
              )}
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Confirmar exclusão
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

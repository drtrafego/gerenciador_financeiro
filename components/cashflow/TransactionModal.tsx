"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/server/actions/transactions";

const schema = z.object({
  type:        z.enum(["income", "expense"]),
  category:    z.string().min(1, "Categoria obrigatória"),
  description: z.string().min(2, "Descrição obrigatória"),
  amount:      z.coerce.number().positive("Valor obrigatório"),
  currency:    z.enum(["BRL", "USD", "ARS"]),
  date:        z.string().min(1, "Data obrigatória"),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = {
  income:  ["Mensalidade", "Projeto", "Consultoria", "Outros"],
  expense: ["Ferramentas", "Imposto", "Salário", "Contador", "Marketing", "Outros"],
};

export default function TransactionModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "income",
      currency: "BRL",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const type = watch("type");

  const onSubmit = async (data: FormData) => {
    await createTransaction(data);
    router.refresh();
    onClose();
  };

  const inputClass =
    "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Novo Lançamento</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {/* Tipo toggle */}
          <div className="flex gap-2">
            {(["income", "expense"] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all
                  ${watch("type") === t
                    ? t === "income"
                      ? "border-green-500 bg-green-500/10 text-green-400"
                      : "border-red-500 bg-red-500/10 text-red-400"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}
              >
                <input {...register("type")} type="radio" value={t} className="sr-only" />
                {t === "income" ? "↑ Entrada" : "↓ Saída"}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Valor *</label>
              <input
                {...register("amount")}
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="0,00"
              />
              {errors.amount && (
                <p className="text-xs text-red-400">{errors.amount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Moeda *</label>
              <select {...register("currency")} className={inputClass}>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Categoria *</label>
              <select {...register("category")} className={inputClass}>
                {CATEGORIES[type].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Data *</label>
              <input {...register("date")} type="date" className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Descrição *</label>
            <input
              {...register("description")}
              className={inputClass}
              placeholder="Ex: Mensalidade Pontucar"
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : "Lançar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/server/actions/clients";

const schema = z.object({
  name:         z.string().min(2, "Nome obrigatório"),
  contact_name: z.string().optional(),
  email:        z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone:        z.string().optional(),
  currency:     z.enum(["BRL", "USD", "ARS"]),
  status:       z.enum(["active", "inactive"]),
  notes:        z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function ClientForm({ defaultValues }: { defaultValues?: Partial<FormData> }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "BRL", status: "active", ...defaultValues },
  });

  const onSubmit = async (data: FormData) => {
    await createClient(data);
    router.push("/clients");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome da Empresa *" error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="Ex: Pontucar Alphaville"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          />
        </Field>
        <Field label="Nome do Contato" error={errors.contact_name?.message}>
          <input
            {...register("contact_name")}
            placeholder="Ex: Ricardo Lima"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <input
            {...register("email")}
            type="email"
            placeholder="contato@empresa.com"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          />
        </Field>
        <Field label="Telefone / WhatsApp">
          <input
            {...register("phone")}
            placeholder="+55 11 99999-9999"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          />
        </Field>
        <Field label="Moeda Padrão *">
          <select
            {...register("currency")}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          >
            <option value="BRL">BRL — Real Brasileiro</option>
            <option value="USD">USD — Dólar Americano</option>
            <option value="ARS">ARS — Peso Argentino</option>
          </select>
        </Field>
        <Field label="Status *">
          <select
            {...register("status")}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea
          {...register("notes")}
          rows={3}
          placeholder="Notas internas sobre o cliente..."
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full resize-none"
        />
      </Field>
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
    </form>
  );
}

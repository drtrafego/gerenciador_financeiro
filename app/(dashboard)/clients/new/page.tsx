import ClientForm from "@/components/clients/ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-base font-semibold text-zinc-200 mb-6">Novo Cliente</h2>
      <ClientForm />
    </div>
  );
}

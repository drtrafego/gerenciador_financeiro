export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import ClientsTable from "@/components/clients/ClientsTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function ClientsPage() {
  const data = await db.select().from(clients).orderBy(desc(clients.createdAt));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-200 hidden sm:block">Todos os Clientes</h2>
        <Link href="/clients/new"
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={14} />
          <span className="hidden sm:inline">Novo Cliente</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>
      <ClientsTable clients={data} />
    </div>
  );
}

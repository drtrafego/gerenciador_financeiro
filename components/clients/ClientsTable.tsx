"use client";

import { useState } from "react";
import { Search, MoreHorizontal } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/currency/format";
import Link from "next/link";
import type { Currency } from "@/lib/currency/format";

export default function ClientsTable({ clients }: { clients: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="overdue">Inadimplentes</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-8">Nenhum cliente encontrado</p>
        )}
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:border-zinc-700 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-zinc-200">{c.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {c.contactName} · {c.currency}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Cliente", "Contato", "Moeda", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-zinc-600">
                  Nenhum cliente encontrado
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="hover:text-indigo-400 transition-colors">
                    <p className="text-sm font-medium text-zinc-200">{c.name}</p>
                    <p className="text-xs text-zinc-500">{c.notes?.slice(0, 40)}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-400">{c.contactName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
                    {c.currency}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-700"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenu === c.id && (
                      <div className="absolute right-0 top-8 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 py-1 w-36">
                        <Link
                          href={`/clients/${c.id}`}
                          className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Ver detalhes
                        </Link>
                        <Link
                          href={`/clients/${c.id}`}
                          className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Editar
                        </Link>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

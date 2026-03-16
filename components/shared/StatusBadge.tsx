const statusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Ativo",      className: "bg-green-500/15 text-green-400 border border-green-500/20" },
  inactive:  { label: "Inativo",    className: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20" },
  overdue:   { label: "Inadimpl.",  className: "bg-red-500/15 text-red-400 border border-red-500/20" },
  paid:      { label: "Pago",       className: "bg-green-500/15 text-green-400 border border-green-500/20" },
  sent:      { label: "Enviado",    className: "bg-blue-500/15 text-blue-400 border border-blue-500/20" },
  draft:     { label: "Rascunho",   className: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20" },
  cancelled: { label: "Cancelado",  className: "bg-zinc-700/30 text-zinc-600 border border-zinc-700/20" },
  paused:    { label: "Pausado",    className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = statusConfig[status] ?? { label: status, className: "bg-zinc-800 text-zinc-400" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

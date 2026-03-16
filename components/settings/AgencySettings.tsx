"use client";

import { useState, useTransition } from "react";
import { updateAgencySettings } from "@/server/actions/settings";

export default function AgencySettings({ name, email }: { name: string; email: string }) {
  const [agencyName, setAgencyName] = useState(name);
  const [agencyEmail, setAgencyEmail] = useState(email);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await updateAgencySettings({ name: agencyName, email: agencyEmail });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const inputClass =
    "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 w-full";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-zinc-200 mb-4">Dados da Agência</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Nome da Agência</label>
          <input
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">E-mail</label>
          <input
            value={agencyEmail}
            onChange={(e) => setAgencyEmail(e.target.value)}
            type="email"
            className={inputClass}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={pending}
          className="mt-1 px-5 py-2 w-fit text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {saved ? "✓ Salvo!" : pending ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </div>
  );
}

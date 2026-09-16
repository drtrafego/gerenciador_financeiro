"use client";

import React, { useState, useEffect } from "react";
import { useProfile } from "@/lib/contexts/ProfileContext";
import { DICTIONARY } from "@/lib/i18n/dict";
import { Baby, User, Plus, Pencil, Check, Trash2, Globe, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function PersonalSettingsView() {
  const { lang, setLang } = useProfile();
  const dict = DICTIONARY[lang];

  const [parentsList, setParentsList] = useState<string[]>([]);
  const [newParentName, setNewParentName] = useState("");

  const [childrenList, setChildrenList] = useState<string[]>([]);
  const [newChildName, setNewChildName] = useState("");

  // Edit states for Parents & Children
  const [editingParentName, setEditingParentName] = useState<string | null>(null);
  const [tempParentName, setTempParentName] = useState("");

  const [editingChildName, setEditingChildName] = useState<string | null>(null);
  const [tempChildName, setTempChildName] = useState("");

  const handleStartEditParent = (oldName: string) => {
    setEditingParentName(oldName);
    setTempParentName(oldName);
  };

  const handleSaveEditParent = (oldName: string) => {
    const newName = tempParentName.trim();
    if (!newName) return;
    
    const updatedParents = parentsList.map((p) => (p === oldName ? newName : p));
    saveParents(updatedParents);

    const savedTxs = localStorage.getItem("user_personal_transactions");
    if (savedTxs) {
      try {
        const txs = JSON.parse(savedTxs);
        if (Array.isArray(txs)) {
          const updatedTxs = txs.map((t: any) =>
            t.childTag === oldName ? { ...t, childTag: newName } : t
          );
          localStorage.setItem("user_personal_transactions", JSON.stringify(updatedTxs));
          window.dispatchEvent(new Event("user_pf_data_changed"));
        }
      } catch (e) {}
    }

    setEditingParentName(null);
  };

  const handleStartEditChild = (oldName: string) => {
    setEditingChildName(oldName);
    setTempChildName(oldName);
  };

  const handleSaveEditChild = (oldName: string) => {
    const newName = tempChildName.trim();
    if (!newName) return;

    const updatedChildren = childrenList.map((c) => (c === oldName ? newName : c));
    saveChildren(updatedChildren);

    const savedTxs = localStorage.getItem("user_personal_transactions");
    if (savedTxs) {
      try {
        const txs = JSON.parse(savedTxs);
        if (Array.isArray(txs)) {
          const updatedTxs = txs.map((t: any) =>
            t.childTag === oldName ? { ...t, childTag: newName } : t
          );
          localStorage.setItem("user_personal_transactions", JSON.stringify(updatedTxs));
          window.dispatchEvent(new Event("user_pf_data_changed"));
        }
      } catch (e) {}
    }

    setEditingChildName(null);
  };

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const loadData = () => {
      const storedParents = localStorage.getItem("user_personal_parents");
      if (storedParents) {
        try {
          const parsed = JSON.parse(storedParents);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setParentsList(parsed);
          }
        } catch (e) {}
      } else {
        localStorage.setItem("user_personal_parents", JSON.stringify([]));
      }

      const storedChildren = localStorage.getItem("user_personal_children");
      if (storedChildren) {
        try {
          setChildrenList(JSON.parse(storedChildren));
        } catch (e) {}
      }
    };

    loadData();

    window.addEventListener("user_pf_data_changed", loadData);
    window.addEventListener("storage", loadData);

    return () => {
      window.removeEventListener("user_pf_data_changed", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, []);

  const saveParents = (updated: string[]) => {
    setParentsList(updated);
    localStorage.setItem("user_personal_parents", JSON.stringify(updated));
    window.dispatchEvent(new Event("user_pf_data_changed"));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const saveChildren = (updated: string[]) => {
    setChildrenList(updated);
    localStorage.setItem("user_personal_children", JSON.stringify(updated));
    window.dispatchEvent(new Event("user_pf_data_changed"));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleAddParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParentName.trim()) return;
    const updated = [...parentsList, newParentName.trim()];
    saveParents(updated);
    setNewParentName("");
  };

  const handleDeleteParent = (name: string) => {
    if (parentsList.length <= 1) {
      alert("É necessário ter pelo menos 1 titular cadastrado.");
      return;
    }
    const updated = parentsList.filter((p) => p !== name);
    saveParents(updated);
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;
    const updated = [...childrenList, newChildName.trim()];
    saveChildren(updated);
    setNewChildName("");
  };

  const handleDeleteChild = (name: string) => {
    const updated = childrenList.filter((c) => c !== name);
    saveChildren(updated);
  };

  const handleClearPersonalData = () => {
    if (confirm("Tem certeza que deseja zerar todos os lançamentos de teste do Modo Pessoal (PF)? Seus dados da empresa (PJ) continuarão 100% seguros.")) {
      localStorage.removeItem("user_personal_transactions");
      alert("Dados pessoais zerados com sucesso!");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-purple-400" />
          Configurações do Perfil Pessoal & Familiar
        </h2>
        <p className="text-xs text-zinc-400">
          Gerencie os titulares da conta, dependentes/filhos, idioma da interface e dados pessoais
        </p>
      </div>

      {/* Isolation Badge */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1 text-xs">
        <div className="flex items-center gap-2 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Isolamento Total Garantido</span>
        </div>
        <p className="text-zinc-300">
          Suas configurações pessoais e lançamentos não afetam em nada os clientes, contratos ou faturas da empresa (PJ).
        </p>
      </div>

      {/* Titulares da Conta (Responsáveis) */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              Titulares Pessoais (Responsáveis)
            </h3>
            <p className="text-xs text-zinc-400">Pessoas principais responsáveis pelas despesas familiares.</p>
          </div>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
            {parentsList.length} titulares
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {parentsList.map((parent, idx) => {
            const isEditing = editingParentName === parent;
            return (
              <div
                key={idx}
                className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={tempParentName}
                      onChange={(e) => setTempParentName(e.target.value)}
                      className="bg-zinc-950 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white outline-none w-28"
                    />
                    <button
                      onClick={() => handleSaveEditParent(parent)}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                      title="Salvar novo nome"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span>👤 {parent}</span>
                    <button
                      onClick={() => handleStartEditParent(parent)}
                      className="text-indigo-400 hover:text-white transition-colors"
                      title="Editar nome do titular"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteParent(parent)}
                      className="text-indigo-400 hover:text-rose-300 transition-colors"
                      title="Remover titular"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddParent} className="flex gap-2 pt-2">
          <input
            type="text"
            required
            placeholder="Nome do novo titular (ex: Titular 1, Titular 2...)"
            value={newParentName}
            onChange={(e) => setNewParentName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow"
          >
            <Plus size={14} />
            <span>Adicionar Titular</span>
          </button>
        </form>
      </div>

      {/* Filhos e Dependentes */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Baby className="w-4 h-4 text-pink-400" />
              Dependentes & Filhos Cadastrados
            </h3>
            <p className="text-xs text-zinc-400">Atribua gastos individuais para cada filho ou dependente.</p>
          </div>
          <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-bold">
            {childrenList.length} dependentes
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {childrenList.map((child, idx) => {
            const isEditing = editingChildName === child;
            return (
              <div
                key={idx}
                className="bg-pink-500/20 text-pink-300 border border-pink-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={tempChildName}
                      onChange={(e) => setTempChildName(e.target.value)}
                      className="bg-zinc-950 border border-pink-500 rounded px-2 py-0.5 text-xs text-white outline-none w-28"
                    />
                    <button
                      onClick={() => handleSaveEditChild(child)}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                      title="Salvar novo nome"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span>👶 {child}</span>
                    <button
                      onClick={() => handleStartEditChild(child)}
                      className="text-pink-400 hover:text-white transition-colors"
                      title="Editar nome do dependente"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteChild(child)}
                      className="text-pink-400 hover:text-rose-300 transition-colors"
                      title="Remover dependente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddChild} className="flex gap-2 pt-2">
          <input
            type="text"
            required
            placeholder="Nome do dependente/filho..."
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white flex items-center gap-1.5 shadow"
          >
            <Plus size={14} />
            <span>Adicionar Filho</span>
          </button>
        </form>

        {savedSuccess && (
          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 pt-1">
            <CheckCircle2 size={13} /> Configurações salvas com sucesso!
          </p>
        )}
      </div>

      {/* Idioma da Interface */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />
          Idioma da Interface Pessoal
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setLang("pt")}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              lang === "pt"
                ? "bg-purple-600/20 border-purple-500 text-purple-300 font-bold"
                : "border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <span>🇧🇷 Português (Brasil)</span>
          </button>
          <button
            onClick={() => setLang("es")}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              lang === "es"
                ? "bg-purple-600/20 border-purple-500 text-purple-300 font-bold"
                : "border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <span>🇦🇷 Español (Argentina)</span>
          </button>
        </div>
      </div>

      {/* Zerar Dados Pessoais de Teste */}
      <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-950/10 space-y-3">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Zerar Lançamentos Pessoais</span>
        </div>
        <p className="text-xs text-zinc-400">
          Se você quiser recomeçar o seu orçamento pessoal do zero, clique abaixo para apagar o histórico de lançamentos pessoais salvos neste navegador.
        </p>
        <button
          onClick={handleClearPersonalData}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all"
        >
          Limpar Todos os Gastos Pessoais
        </button>
      </div>
    </div>
  );
}

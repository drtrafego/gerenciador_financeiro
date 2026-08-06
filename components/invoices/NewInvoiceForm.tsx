"use client";

import { useState } from "react";
import { createInvoiceAction } from "@/app/(dashboard)/invoices/actions";

interface ContractOption {
  id: string;
  name: string | null;
  type: string;
  fixedAmount: string;
  currency: string;
  clientId: string | null;
  clientName: string | null;
}

interface AvulsaOption {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  clientId: string | null;
  clientName: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  clients: ClientOption[];
  contracts: ContractOption[];
  avulsas: AvulsaOption[];
  defaultClientId?: string;
  defaultContractId?: string;
  defaultDue: string;
}

function formatDateBR(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
}

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function NewInvoiceForm({
  clients,
  contracts,
  avulsas,
  defaultClientId,
  defaultContractId,
  defaultDue,
}: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [contractId, setContractId] = useState(defaultContractId ?? "");
  const [transactionId, setTransactionId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId ?? "");
  const [description, setDescription] = useState("");

  function handleContractChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setContractId(id);
    if (!id) return;
    setTransactionId("");
    const c = contracts.find((c) => c.id === id);
    if (!c) return;
    setAmount(parseFloat(c.fixedAmount).toFixed(2).replace(".", ","));
    setCurrency(c.currency);
    if (c.clientId) setSelectedClientId(c.clientId);
  }

  function handleAvulsaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setTransactionId(id);
    if (!id) return;
    setContractId("");
    const t = avulsas.find((t) => t.id === id);
    if (!t) return;
    setAmount(parseFloat(t.amount).toFixed(2).replace(".", ","));
    setCurrency(t.currency);
    setDescription(t.description);
    if (t.clientId) setSelectedClientId(t.clientId);
  }

  return (
    <form action={createInvoiceAction} className="space-y-5">
      <input type="hidden" name="transactionId" value={transactionId} />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Cliente *</label>
            <select
              name="clientId"
              required
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Contrato vinculado <span className="text-zinc-500 font-normal">(opcional)</span>
            </label>
            <select
              name="contractId"
              value={contractId}
              onChange={handleContractChange}
              className={inputClass}
            >
              <option value="">Sem contrato vinculado</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName} — {c.name ?? c.type.replace(/_/g, " ")} ({c.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Receita avulsa vinculada <span className="text-zinc-500 font-normal">(opcional, sem contrato)</span>
            </label>
            <select
              value={transactionId}
              onChange={handleAvulsaChange}
              className={inputClass}
            >
              <option value="">Sem receita avulsa vinculada</option>
              {avulsas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.clientName ?? "Sem cliente"} — {t.description} — {formatDateBR(t.date)}
                </option>
              ))}
            </select>
            {avulsas.length === 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Nenhuma receita avulsa pendente de fatura no momento.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo *</label>
            <select name="type" required defaultValue="monthly" className={inputClass}>
              <option value="monthly">Mensal</option>
              <option value="project">Projeto</option>
              <option value="proposal">Proposta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
            <select name="status" defaultValue="draft" className={inputClass}>
              <option value="draft">Rascunho</option>
              <option value="sent">Enviado</option>
              <option value="paid">Pago</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Valor *</label>
            <input
              name="amount"
              required
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Moeda</label>
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            >
              <option value="BRL">BRL — Real</option>
              <option value="USD">USD — Dólar</option>
              <option value="ARS">ARS — Peso</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Data de vencimento *</label>
            <input name="dueDate" type="date" required defaultValue={defaultDue} className={inputClass} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição</label>
            <textarea
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass + " resize-none"}
              placeholder="Gestão de tráfego — Meta Ads — Mês de Janeiro/2026"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Forma de pagamento</label>
            <input
              name="paymentMethod"
              className={inputClass}
              placeholder="PIX, Transferência Bancária, Boleto..."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Observações internas</label>
            <textarea
              name="notes"
              rows={2}
              className={inputClass + " resize-none"}
              placeholder="Notas internas (não aparecem na fatura pública)"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          Criar Fatura
        </button>
        <a
          href="/invoices"
          className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

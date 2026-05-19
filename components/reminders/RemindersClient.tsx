"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Plus, MessageSquare, Wifi, WifiOff, Loader2, Trash2, X, Check, RefreshCw, Pencil, Repeat } from "lucide-react";
import { createReminderAction, cancelReminderAction, deleteReminderAction, createTemplateAction, deleteTemplateAction, updateReminderAction, saveAlertPhoneAction } from "@/app/(dashboard)/reminders/actions";
import { useRouter } from "next/navigation";

const WPP_URL = process.env.NEXT_PUBLIC_WPP_URL ?? "";
const WPP_KEY = process.env.NEXT_PUBLIC_WPP_KEY ?? "";

type ReminderRow = {
  reminder: {
    id: string;
    phone: string;
    triggerDate: string;
    triggerTime: string | null;
    status: string | null;
    customMessage: string | null;
    sentAt: Date | null;
    errorMessage: string | null;
    startDate: string | null;
    endDate: string | null;
    recurring: boolean | null;
  };
  clientName: string | null;
  templateName: string | null;
};

type Template = {
  id: string;
  name: string;
  body: string;
  isDefault: string | null;
  clientId: string | null;
};

type Client = {
  id: string;
  name: string;
  phone: string | null;
};

type WppStatus = { connected: boolean; hasQR: boolean } | null;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  sent: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-700/20 text-zinc-500 border-zinc-700/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
  completed: "Concluído",
};

type Tab = "connection" | "reminders" | "sent" | "templates" | "settings";

function ReminderTable({ rows, templates, onEdit, onCancel, onDelete }: {
  rows: ReminderRow[];
  templates: Template[];
  onEdit: (row: ReminderRow) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {["Cliente", "Telefone", "Data", "Template/Mensagem", "Recorrente", "Status", ""].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map(({ reminder, clientName, templateName }) => (
            <tr key={reminder.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-3 font-medium text-white">{clientName ?? "—"}</td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{reminder.phone}</td>
              <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                {new Date(reminder.triggerDate + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                {reminder.customMessage ? (
                  <span className="text-zinc-300">{reminder.customMessage.slice(0, 40)}…</span>
                ) : (
                  <span className="text-indigo-400">{templateName ?? "—"}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {reminder.recurring ? (
                  <span className="flex items-center gap-1 text-xs text-indigo-400">
                    <Repeat size={12} />
                    Mensal
                  </span>
                ) : (
                  <span className="text-zinc-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[reminder.status ?? "pending"]}`}>
                  {STATUS_LABELS[reminder.status ?? "pending"]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit({ reminder, clientName, templateName })}
                    className="text-zinc-600 hover:text-indigo-400 p-1 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  {reminder.status === "pending" && (
                    <button
                      onClick={() => onCancel(reminder.id)}
                      className="text-zinc-600 hover:text-yellow-400 p-1 rounded transition-colors"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(reminder.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RemindersClient({ reminders, templates, clients, alertPhone: initialAlertPhone }: {
  reminders: ReminderRow[];
  templates: Template[];
  clients: Client[];
  alertPhone: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("connection");
  const [wppStatus, setWppStatus] = useState<WppStatus>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Modais
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderRow | null>(null);

  // Form lembrete (criação)
  const [selectedClientId, setSelectedClientId] = useState("");
  const [phone, setPhone] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [triggerTime, setTriggerTime] = useState("08:00");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [indefinite, setIndefinite] = useState(true);
  const [endDate, setEndDate] = useState("");

  // Form lembrete (edição)
  const [editPhone, setEditPhone] = useState("");
  const [editTriggerDate, setEditTriggerDate] = useState("");
  const [editTriggerTime, setEditTriggerTime] = useState("08:00");
  const [editTemplateId, setEditTemplateId] = useState("");
  const [editCustomMessage, setEditCustomMessage] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editIndefinite, setEditIndefinite] = useState(true);

  // Form template
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  // Configurações de alerta
  const [alertPhoneInput, setAlertPhoneInput] = useState(initialAlertPhone);
  const [savingAlertPhone, setSavingAlertPhone] = useState(false);
  const [alertPhoneSaved, setAlertPhoneSaved] = useState(false);

  const fetchStatus = async () => {
    if (!WPP_URL) return;
    try {
      const res = await fetch(`${WPP_URL}/status`, { headers: { "x-api-key": WPP_KEY } });
      const data = await res.json();
      setWppStatus(data);
    } catch {
      setWppStatus(null);
    }
  };

  const fetchQR = async () => {
    if (!WPP_URL) return;
    setLoadingQR(true);
    try {
      const res = await fetch(`${WPP_URL}/qr`, { headers: { "x-api-key": WPP_KEY } });
      const data = await res.json();
      if (data.connected) {
        setWppStatus({ connected: true, hasQR: false });
        setQrUrl(null);
      } else if (data.qr) {
        setQrUrl(data.qr);
      }
    } catch {
      setQrUrl(null);
    } finally {
      setLoadingQR(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (tab !== "connection") return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [tab]);

  useEffect(() => {
    if (tab !== "connection" || wppStatus?.connected) return;
    fetchQR();
    const interval = setInterval(fetchQR, 10000);
    return () => clearInterval(interval);
  }, [tab, wppStatus?.connected]);

  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    const c = clients.find((c) => c.id === id);
    if (c?.phone) setPhone(c.phone);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("clientId", selectedClientId);
    fd.append("phone", phone);
    fd.append("triggerDate", triggerDate);
    fd.append("triggerTime", triggerTime);
    if (selectedTemplateId) fd.append("templateId", selectedTemplateId);
    if (customMessage) fd.append("customMessage", customMessage);
    fd.append("startDate", triggerDate);
    if (!indefinite && endDate) fd.append("endDate", endDate);
    fd.append("recurring", String(recurring));
    startTransition(async () => {
      await createReminderAction(fd);
      setShowReminderModal(false);
      setSelectedClientId("");
      setPhone("");
      setTriggerDate("");
      setCustomMessage("");
      setRecurring(false);
      setIndefinite(true);
      setEndDate("");
      router.refresh();
    });
  };

  const handleOpenEdit = (row: ReminderRow) => {
    setEditingReminder(row);
    setEditPhone(row.reminder.phone);
    setEditTriggerDate(row.reminder.triggerDate);
    setEditTriggerTime(row.reminder.triggerTime ?? "08:00");
    setEditTemplateId("");
    setEditCustomMessage(row.reminder.customMessage ?? "");
    setEditStartDate(row.reminder.startDate ?? row.reminder.triggerDate);
    setEditEndDate(row.reminder.endDate ?? "");
    setEditRecurring(row.reminder.recurring ?? false);
    setEditIndefinite(!row.reminder.endDate);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;
    const fd = new FormData();
    fd.append("phone", editPhone);
    fd.append("triggerDate", editStartDate);
    fd.append("triggerTime", editTriggerTime);
    if (editTemplateId) fd.append("templateId", editTemplateId);
    if (editCustomMessage) fd.append("customMessage", editCustomMessage);
    fd.append("startDate", editStartDate);
    if (!editIndefinite && editEndDate) fd.append("endDate", editEndDate);
    fd.append("recurring", String(editRecurring));
    startTransition(async () => {
      await updateReminderAction(editingReminder.reminder.id, fd);
      setEditingReminder(null);
      router.refresh();
    });
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", templateName);
    fd.append("body", templateBody);
    startTransition(async () => {
      await createTemplateAction(fd);
      setShowTemplateModal(false);
      setTemplateName("");
      setTemplateBody("");
      router.refresh();
    });
  };

  const handleCancel = (id: string) => {
    startTransition(async () => {
      await cancelReminderAction(id);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteReminderAction(id);
      router.refresh();
    });
  };

  const handleDeleteTemplate = (id: string) => {
    startTransition(async () => {
      await deleteTemplateAction(id);
      router.refresh();
    });
  };

  const handleSaveAlertPhone = async () => {
    setSavingAlertPhone(true);
    await saveAlertPhoneAction(alertPhoneInput);
    setSavingAlertPhone(false);
    setAlertPhoneSaved(true);
    setTimeout(() => setAlertPhoneSaved(false), 3000);
  };

  const pendingReminders = reminders.filter((r) => r.reminder.status === "pending" || r.reminder.status === "cancelled");
  const sentReminders = reminders.filter((r) => r.reminder.status === "sent" || r.reminder.status === "failed" || r.reminder.status === "completed");
  const pendingCount = reminders.filter((r) => r.reminder.status === "pending").length;
  const sentCount = sentReminders.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-400" />
            Lembretes WhatsApp
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {pendingCount} pendente(s) · {sentCount} enviado(s)
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            wppStatus?.connected
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          {wppStatus?.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {wppStatus?.connected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800 rounded-lg p-1 w-fit">
        {(["connection", "reminders", "sent", "templates", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "connection" ? "Conexão" : t === "reminders" ? "Lembretes" : t === "sent" ? "Enviados" : t === "templates" ? "Templates" : "Configurações"}
          </button>
        ))}
      </div>

      {/* ── ABA CONEXÃO ── */}
      {tab === "connection" && (
        <div className="max-w-lg space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Status da Conexão</h2>

            {!WPP_URL ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-400">
                Configure <code className="font-mono">NEXT_PUBLIC_WPP_URL</code> e <code className="font-mono">NEXT_PUBLIC_WPP_KEY</code> nas variáveis de ambiente.
              </div>
            ) : wppStatus?.connected ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                <Check size={20} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-400">WhatsApp conectado</p>
                  <p className="text-xs text-zinc-400 mt-0.5">O sistema está pronto para enviar mensagens.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Escaneie o QR code abaixo com o WhatsApp do seu celular para conectar.
                  A sessão fica salva — você só precisa escanear uma vez.
                </p>

                <div className="flex flex-col items-center gap-4">
                  {qrUrl ? (
                    <div className="bg-white p-3 rounded-xl">
                      <img src={qrUrl} alt="QR Code WhatsApp" className="w-56 h-56" />
                    </div>
                  ) : (
                    <div className="w-64 h-64 bg-zinc-800 border border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-3 text-zinc-500">
                      {loadingQR ? (
                        <Loader2 size={32} className="animate-spin" />
                      ) : (
                        <>
                          <MessageSquare size={32} />
                          <p className="text-xs text-center">Clique em "Gerar QR Code"<br />para conectar</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={fetchQR}
                      disabled={loadingQR}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {loadingQR ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {qrUrl ? "Novo QR Code" : "Gerar QR Code"}
                    </button>
                    <button
                      onClick={fetchStatus}
                      className="px-4 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      Verificar status
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">Como funciona</h2>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">1.</span>Conecte o WhatsApp escaneando o QR code acima.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">2.</span>Crie templates de mensagem com variáveis como {"{nome}"}, {"{valor}"}, {"{data}"}.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">3.</span>Crie lembretes manualmente ou deixe o sistema gerar automaticamente na data de vencimento.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">4.</span>O sistema envia as mensagens automaticamente no horário configurado.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── ABA LEMBRETES ── */}
      {tab === "reminders" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowReminderModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              Novo Lembrete
            </button>
          </div>

          {pendingReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
              <Bell className="h-10 w-10 text-zinc-600 mb-4" />
              <p className="text-zinc-400 font-medium">Nenhum lembrete pendente</p>
            </div>
          ) : (
            <ReminderTable rows={pendingReminders} templates={templates} onEdit={handleOpenEdit} onCancel={handleCancel} onDelete={handleDelete} />
          )}
        </div>
      )}

      {/* ── ABA ENVIADOS ── */}
      {tab === "sent" && (
        <div className="space-y-4">
          {sentReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
              <Bell className="h-10 w-10 text-zinc-600 mb-4" />
              <p className="text-zinc-400 font-medium">Nenhuma notificação enviada ainda</p>
            </div>
          ) : (
            <ReminderTable rows={sentReminders} templates={templates} onEdit={handleOpenEdit} onCancel={handleCancel} onDelete={handleDelete} />
          )}
        </div>
      )}

      {/* ── ABA TEMPLATES ── */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              Novo Template
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">Variáveis disponíveis nos templates:</p>
            <p><code className="text-indigo-400">{"{nome}"}</code> — Nome do cliente</p>
            <p><code className="text-indigo-400">{"{valor}"}</code> — Valor da fatura</p>
            <p><code className="text-indigo-400">{"{data}"}</code> — Data de vencimento</p>
            <p><code className="text-indigo-400">{"{dias}"}</code> — Dias para vencimento</p>
          </div>

          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-center">
              <MessageSquare className="h-10 w-10 text-zinc-600 mb-4" />
              <p className="text-zinc-400 font-medium">Nenhum template cadastrado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {templates.map((t) => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        {t.isDefault === "true" && (
                          <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-2 whitespace-pre-wrap">{t.body}</p>
                    </div>
                    {t.isDefault !== "true" && (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="ml-4 text-zinc-600 hover:text-red-400 p-1 rounded transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA CONFIGURAÇÕES ── */}
      {tab === "settings" && (
        <div className="max-w-lg space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Alertas de Conexão</h2>
            <p className="text-sm text-zinc-400">
              Quando o WhatsApp desconectar e reconectar, uma mensagem será enviada para este número.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                Telefone para alertas
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={alertPhoneInput}
                  onChange={(e) => setAlertPhoneInput(e.target.value)}
                  placeholder="Ex: 11999999999 ou +351912345678"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveAlertPhone}
                  disabled={savingAlertPhone || !alertPhoneInput}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingAlertPhone ? <Loader2 size={14} className="animate-spin" /> : alertPhoneSaved ? <Check size={14} /> : null}
                  Salvar
                </button>
              </div>
              {alertPhoneSaved && (
                <p className="text-xs text-green-400">Número salvo com sucesso.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOVO LEMBRETE ── */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Novo Lembrete</h2>
              <button onClick={() => setShowReminderModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateReminder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cliente</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Telefone WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5511999999999"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-zinc-600 mt-1">Números brasileiros: 55 + DDD + número. Internacionais: código do país + número completo.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Data do primeiro envio</label>
                  <input
                    type="date"
                    value={triggerDate}
                    onChange={(e) => setTriggerDate(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Hora</label>
                  <input
                    type="time"
                    value={triggerTime}
                    onChange={(e) => setTriggerTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setRecurring(!recurring)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recurring ? "bg-indigo-600" : "bg-zinc-700"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${recurring ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
                <label className="text-sm text-zinc-300 flex items-center gap-1.5">
                  <Repeat size={13} className="text-zinc-500" />
                  Repetir mensalmente
                </label>
              </div>

              {recurring && (
                <div className="space-y-3 pl-2 border-l-2 border-indigo-500/30">
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={indefinite}
                      onChange={(e) => setIndefinite(e.target.checked)}
                      className="rounded border-zinc-600 bg-zinc-800"
                    />
                    Sem data de fim
                  </label>
                  {!indefinite && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Data de encerramento</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Nenhum (usar mensagem personalizada)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {!selectedTemplateId && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Mensagem personalizada</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    required={!selectedTemplateId}
                    placeholder="Digite a mensagem…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Criar Lembrete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR LEMBRETE ── */}
      {editingReminder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Editar Lembrete</h2>
              <button onClick={() => setEditingReminder(null)} className="text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Telefone WhatsApp</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="5511999999999"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-zinc-600 mt-1">Números brasileiros: 55 + DDD + número. Internacionais: código do país + número completo.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Data do próximo envio</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Hora</label>
                  <input
                    type="time"
                    value={editTriggerTime}
                    onChange={(e) => setEditTriggerTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setEditRecurring(!editRecurring)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editRecurring ? "bg-indigo-600" : "bg-zinc-700"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${editRecurring ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
                <label className="text-sm text-zinc-300 flex items-center gap-1.5">
                  <Repeat size={13} className="text-zinc-500" />
                  Repetir mensalmente
                </label>
              </div>

              {editRecurring && (
                <div className="space-y-3 pl-2 border-l-2 border-indigo-500/30">
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIndefinite}
                      onChange={(e) => setEditIndefinite(e.target.checked)}
                      className="rounded border-zinc-600 bg-zinc-800"
                    />
                    Sem data de fim
                  </label>
                  {!editIndefinite && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Data de encerramento</label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Template</label>
                <select
                  value={editTemplateId}
                  onChange={(e) => setEditTemplateId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Nenhum (usar mensagem personalizada)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {!editTemplateId && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Mensagem personalizada</label>
                  <textarea
                    value={editCustomMessage}
                    onChange={(e) => setEditCustomMessage(e.target.value)}
                    rows={3}
                    required={!editTemplateId}
                    placeholder="Digite a mensagem…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingReminder(null)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL NOVO TEMPLATE ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Novo Template</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nome do template</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Lembrete 3 dias antes"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mensagem</label>
                <textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={4}
                  required
                  placeholder={"Olá *{nome}*, seu honorário de *{valor}* vence em *{data}*."}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <p className="text-xs text-zinc-600 mt-1">Use *texto* para negrito no WhatsApp</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Salvar Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

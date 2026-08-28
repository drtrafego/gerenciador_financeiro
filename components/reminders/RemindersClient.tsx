"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Plus, MessageSquare, Wifi, WifiOff, Loader2, Trash2, X, Check, RefreshCw, Pencil, Repeat, CalendarClock } from "lucide-react";
import { createReminderAction, cancelReminderAction, deleteReminderAction, createTemplateAction, deleteTemplateAction, updateTemplateAction, updateReminderAction, saveAlertPhoneAction, setDefaultTemplateAction, confirmPaymentAction, undoPaymentConfirmationAction } from "@/app/(dashboard)/reminders/actions";
import { sendDateFor } from "@/lib/billing/schedule";
import { useRouter } from "next/navigation";

type ReminderRow = {
  reminder: {
    id: string;
    phone: string;
    triggerDate: string;
    triggerTime: string | null;
    status: string | null;
    stage: string;
    contractId: string | null;
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

type BillingCycle = {
  key: string;
  contractId: string;
  contractName: string | null;
  amount: string;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  dueDate: string;
  confirmation: {
    id: string;
    confirmedAt: Date;
    actor: string | null;
    source: string;
    note: string | null;
  } | null;
  reminders: {
    id: string;
    stage: string;
    status: string | null;
    sentAt: Date | null;
    errorMessage: string | null;
    customMessage: string | null;
  }[];
  cycleStatus: string;
  nextStage: string | null;
  nextSendDate: string | null;
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

type Tab = "connection" | "reminders" | "billing" | "sent" | "templates" | "settings";

// Etapa do ciclo de cobrança da linha de lembrete. Lembrete sem contrato é avulso.
const STAGE_LABELS: Record<string, string> = {
  due: "Vencimento",
  overdue_d2: "Atraso D+2",
  overdue_d5: "Atraso D+5",
};

const CYCLE_LABELS: Record<string, string> = {
  paid: "Pago",
  due_failed: "Falha no aviso",
  closed: "Encerrado",
  dunned_d5: "Cobrado D+5",
  dunned_d2: "Cobrado D+2",
  notified: "Avisado",
  pending: "Aguardando envio",
};

const CYCLE_COLORS: Record<string, string> = {
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  due_failed: "bg-red-500/10 text-red-400 border-red-500/20",
  closed: "bg-zinc-700/20 text-zinc-400 border-zinc-700/20",
  dunned_d5: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  dunned_d2: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  notified: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const CYCLE_STAGES: { stage: "due" | "overdue_d2" | "overdue_d5"; label: string }[] = [
  { stage: "due", label: "Aviso do vencimento" },
  { stage: "overdue_d2", label: "Cobrança D+2" },
  { stage: "overdue_d5", label: "Cobrança D+5" },
];

type BillingFilter = "all" | "open" | "paid" | "failed";

function formatIsoBr(iso: string) {
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function formatBRLValue(value: string | null) {
  if (!value) return "—";
  return `R$ ${parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayBrtIso() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split("T")[0]!;
}

function BillingCycleCard({ cycle, onConfirm, onUndo, busy }: {
  cycle: BillingCycle;
  onConfirm: (cycle: BillingCycle) => void;
  onUndo: (cycle: BillingCycle) => void;
  busy: boolean;
}) {
  const todayIso = todayBrtIso();
  const confirmado = cycle.confirmation !== null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {cycle.contractName?.trim() || "Serviço"}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Vencimento {formatIsoBr(cycle.dueDate)} · {formatBRLValue(cycle.amount)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CYCLE_COLORS[cycle.cycleStatus] ?? CYCLE_COLORS.pending}`}>
          {confirmado && cycle.confirmation
            ? `Pago, confirmado em ${new Date(cycle.confirmation.confirmedAt).toLocaleDateString("pt-BR")}${cycle.confirmation.actor ? ` por ${cycle.confirmation.actor}` : ""}`
            : CYCLE_LABELS[cycle.cycleStatus] ?? CYCLE_LABELS.pending}
        </span>
      </div>

      <ul className="space-y-1.5">
        {CYCLE_STAGES.map(({ stage, label }) => {
          const row = cycle.reminders.find((r) => r.stage === stage);
          const sendDate = sendDateFor(cycle.dueDate, stage);

          let detalhe: string;
          let cor = "text-zinc-500";
          if (row?.status === "sent") {
            detalhe = `enviado em ${row.sentAt ? new Date(row.sentAt).toLocaleDateString("pt-BR") : formatIsoBr(sendDate)}`;
            cor = "text-green-400";
          } else if (row?.status === "failed") {
            detalhe = `falhou: ${row.errorMessage ?? "erro desconhecido"}`;
            cor = "text-red-400";
          } else if (row?.status === "cancelled") {
            detalhe = row.errorMessage ?? "cancelado";
          } else if (confirmado) {
            detalhe = "não aplicável (pagamento confirmado)";
          } else if (sendDate >= todayIso) {
            detalhe = `previsto para ${formatIsoBr(sendDate)}`;
            cor = "text-zinc-400";
          } else {
            detalhe = "não aplicável";
          }

          return (
            <li key={stage} className="flex items-baseline gap-2 text-xs">
              <span className="text-zinc-300 w-40 shrink-0">{label}</span>
              <span className={cor}>{detalhe}</span>
            </li>
          );
        })}
      </ul>

      {/* Confirmar emite fatura e dispara e-mail ao cliente, então no celular o
          alvo é de 40px cheios. A partir de sm os dois voltam ao tamanho atual. */}
      <div className="flex justify-end">
        {confirmado ? (
          <button
            onClick={() => onUndo(cycle)}
            disabled={busy}
            className="inline-flex items-center h-10 sm:h-auto px-2 sm:py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded transition-colors disabled:opacity-50"
          >
            Desfazer
          </button>
        ) : (
          <button
            onClick={() => onConfirm(cycle)}
            disabled={busy}
            className="flex items-center gap-1.5 bg-green-600/90 hover:bg-green-500 text-white px-3 py-1.5 h-10 sm:h-auto rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Check size={13} />
            Confirmar pagamento
          </button>
        )}
      </div>
    </div>
  );
}

function ReminderTable({ rows, templates, onEdit, onCancel, onDelete }: {
  rows: ReminderRow[];
  templates: Template[];
  onEdit: (row: ReminderRow) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Formatação resolvida uma única vez e reusada pelos cards do mobile e pela tabela do desktop.
  const items = rows.map((row) => {
    const { reminder, clientName, templateName } = row;
    return {
      row,
      reminder,
      clientName,
      templateName,
      nome: clientName ?? "—",
      dataBr: new Date(reminder.triggerDate + "T12:00:00").toLocaleDateString("pt-BR"),
      etapa: reminder.contractId ? STAGE_LABELS[reminder.stage] ?? reminder.stage : "Avulso",
      trechoMensagem: reminder.customMessage ? `${reminder.customMessage.slice(0, 40)}…` : null,
      statusKey: reminder.status ?? "pending",
      erro: reminder.status === "failed" && reminder.errorMessage ? reminder.errorMessage : null,
    };
  });

  return (
    <>
      {/* Cards do mobile. O telefone fica de fora de propósito: é dado de conferência, o nome do cliente já identifica a linha. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {items.map(({ row, reminder, nome, templateName, dataBr, etapa, trechoMensagem, statusKey, erro }) => (
          <div key={reminder.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-white min-w-0 break-words">{nome}</p>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusKey]}`}>
                {STATUS_LABELS[statusKey]}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
              <span>{dataBr} · {etapa}</span>
              {reminder.recurring && (
                <span className="flex items-center gap-1 text-indigo-400">
                  <Repeat size={12} />
                  mensal
                </span>
              )}
            </div>

            <p className="text-xs truncate">
              {trechoMensagem ? (
                <span className="text-zinc-300">{trechoMensagem}</span>
              ) : (
                <span className="text-indigo-400">{templateName ?? "—"}</span>
              )}
            </p>

            {erro && <p className="text-xs text-red-400/80">{erro}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onEdit(row)}
                className="flex-1 h-10 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                Editar
              </button>
              {reminder.status === "pending" && (
                <button
                  onClick={() => onCancel(reminder.id)}
                  className="flex-1 h-10 rounded-lg bg-zinc-800 text-yellow-400 text-xs font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => onDelete(reminder.id)}
                className="flex-1 h-10 rounded-lg bg-zinc-800 text-red-400 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela do desktop. O min-w é o que faz o overflow-x-auto funcionar. */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Cliente", "Telefone", "Data", "Etapa", "Template/Mensagem", "Recorrente", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map(({ row, reminder, nome, templateName, dataBr, etapa, trechoMensagem, statusKey, erro }) => (
              <tr key={reminder.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{nome}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{reminder.phone}</td>
                <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{dataBr}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{etapa}</td>
                <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                  {trechoMensagem ? (
                    <span className="text-zinc-300">{trechoMensagem}</span>
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
                  <div className="space-y-1">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusKey]}`}>
                      {STATUS_LABELS[statusKey]}
                    </span>
                    {erro && (
                      <p className="text-xs text-red-400/70 max-w-[160px] truncate" title={erro}>{erro}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(row)}
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
    </>
  );
}

export default function RemindersClient({ reminders, templates, clients, alertPhone: initialAlertPhone, billingCycles }: {
  reminders: ReminderRow[];
  templates: Template[];
  clients: Client[];
  alertPhone: string;
  billingCycles: BillingCycle[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("connection");
  const [wppStatus, setWppStatus] = useState<WppStatus>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Erro das ações da aba Vencimentos (confirmar ou desfazer pagamento)
  const [billingError, setBillingError] = useState<string | null>(null);
  // Resultado da confirmação: qual fatura saiu e para quem o recibo foi. Sem
  // isso o operador não tem como saber que o cliente está sem e-mail.
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

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

  // Form template (criação)
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  // Form template (edição)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateBody, setEditTemplateBody] = useState("");

  // Teste de envio
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Configurações de alerta
  const [alertPhoneInput, setAlertPhoneInput] = useState(initialAlertPhone);
  const [savingAlertPhone, setSavingAlertPhone] = useState(false);
  const [alertPhoneSaved, setAlertPhoneSaved] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/wpp/status`, { cache: "no-store" });
      const data = await res.json();
      setWppStatus(data);
    } catch {
      setWppStatus(null);
    }
  };

  const fetchQR = async () => {
    setLoadingQR(true);
    try {
      const res = await fetch(`/api/wpp/qr`, { cache: "no-store" });
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

  const handleSetDefaultTemplate = (id: string, name: string) => {
    if (
      !window.confirm(
        `Definir "${name}" como mensagem padrão?\n\nA partir do próximo envio automático, ela substitui a mensagem atual enviada a todos os clientes.`
      )
    )
      return;
    startTransition(async () => {
      await setDefaultTemplateAction(id);
      router.refresh();
    });
  };

  const handleOpenEditTemplate = (t: Template) => {
    setEditingTemplate(t);
    setEditTemplateName(t.name);
    setEditTemplateBody(t.body);
  };

  const handleSaveEditTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    const fd = new FormData();
    fd.append("name", editTemplateName);
    fd.append("body", editTemplateBody);
    startTransition(async () => {
      await updateTemplateAction(editingTemplate.id, fd);
      setEditingTemplate(null);
      router.refresh();
    });
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/wpp/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, msg: data.ok ? "Mensagem enviada com sucesso!" : `Erro: ${data.error ?? "falha desconhecida"}` });
    } catch (err: any) {
      setTestResult({ ok: false, msg: `Erro de rede: ${err.message}` });
    } finally {
      setTestSending(false);
    }
  };

  const handleConfirmPayment = (cycle: BillingCycle) => {
    const valor = formatBRLValue(cycle.amount);
    if (
      !window.confirm(
        `Confirmar o pagamento de ${valor} do vencimento ${formatIsoBr(cycle.dueDate)}?\n\n` +
          `Isso interrompe as cobranças automáticas de atraso deste vencimento, emite a fatura como quitada ` +
          `e envia o recibo por e-mail para o cliente.`
      )
    )
      return;
    startTransition(async () => {
      const res = await confirmPaymentAction(cycle.contractId, cycle.dueDate);
      if (!res.ok) {
        setBillingError(res.error);
        setBillingNotice(null);
        return;
      }
      setBillingError(null);
      setBillingNotice(
        res.invoiceError
          ? `Pagamento confirmado, mas a fatura não foi emitida: ${res.invoiceError}`
          : res.emailSkipped
            ? `Pagamento confirmado e fatura ${res.invoiceNumber ?? ""} emitida. O recibo NÃO foi enviado: este cliente não tem e-mail cadastrado.`
            : res.invoiceNumber
              ? `Pagamento confirmado. Fatura ${res.invoiceNumber} emitida e recibo a caminho de ${res.emailTo}.`
              : res.alreadyConfirmed
                ? "Este vencimento já estava confirmado como pago."
                : "Pagamento confirmado."
      );
      router.refresh();
    });
  };

  const handleUndoPayment = (cycle: BillingCycle) => {
    if (
      !window.confirm(
        `Desfazer a confirmação de pagamento do vencimento ${formatIsoBr(cycle.dueDate)}?\n\n` +
          `As cobranças que ainda não passaram da data voltam a ser enviadas.`
      )
    )
      return;
    startTransition(async () => {
      const res = await undoPaymentConfirmationAction(cycle.contractId, cycle.dueDate);
      if (!res.ok) {
        setBillingError(res.error);
        return;
      }
      setBillingError(null);
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

  const [billingFilter, setBillingFilter] = useState<BillingFilter>("all");

  const filteredCycles = billingCycles.filter((c) => {
    if (billingFilter === "paid") return c.confirmation !== null;
    if (billingFilter === "open") return c.confirmation === null;
    if (billingFilter === "failed") return c.reminders.some((r) => r.status === "failed");
    return true;
  });

  // Agrupa os ciclos por cliente para o painel ficar legível quando o mesmo
  // cliente tem dois contratos vencendo no mesmo dia.
  const cyclesByClient = new Map<string, BillingCycle[]>();
  for (const cycle of filteredCycles) {
    const nome = cycle.clientName ?? "Cliente sem nome";
    const grupo = cyclesByClient.get(nome);
    if (grupo) grupo.push(cycle);
    else cyclesByClient.set(nome, [cycle]);
  }

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
      <div className="flex flex-nowrap gap-1 bg-zinc-800 rounded-lg p-1 overflow-x-auto">
        {(["connection", "reminders", "billing", "sent", "templates", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t === "connection" ? "Conexão" : t === "reminders" ? "Lembretes" : t === "billing" ? "Vencimentos" : t === "sent" ? "Enviados" : t === "templates" ? "Templates" : "Configurações"}
          </button>
        ))}
      </div>

      {/* ── ABA CONEXÃO ── */}
      {tab === "connection" && (
        <div className="max-w-lg space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Status da Conexão</h2>

            {wppStatus?.connected ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                  <Check size={20} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">WhatsApp conectado</p>
                    <p className="text-xs text-zinc-400 mt-0.5">O sistema está pronto para enviar mensagens.</p>
                  </div>
                </div>
                <form onSubmit={handleTestSend} className="space-y-3 pt-2 border-t border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Testar envio</p>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Telefone (ex: 5511999999999)"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Mensagem de teste…"
                    required
                    rows={2}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={testSending}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {testSending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                      Enviar teste
                    </button>
                    {testResult && (
                      <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.msg}</p>
                    )}
                  </div>
                </form>
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

      {/* ── ABA VENCIMENTOS ── */}
      {tab === "billing" && (
        <div className="space-y-4">
          {billingNotice && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-200">
              <span>{billingNotice}</span>
              {/* O -my-2.5 devolve exatamente a altura do rótulo, então o alvo vira
                  40px sem o aviso engordar. A partir de sm nada disso vale. */}
              <button
                onClick={() => setBillingNotice(null)}
                className="inline-flex items-center h-10 px-2 -my-2.5 -mx-2 sm:h-auto sm:m-0 sm:p-0 text-zinc-400 hover:text-zinc-200 text-xs font-medium shrink-0"
              >
                Fechar
              </button>
            </div>
          )}
          {billingError && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              <span>{billingError}</span>
              <button
                onClick={() => setBillingError(null)}
                className="inline-flex items-center h-10 px-2 -my-2.5 -mx-2 sm:h-auto sm:m-0 sm:p-0 text-red-300 hover:text-red-100 text-xs font-medium shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Mesmo tratamento dos filtros de /invoices: 40px de altura no celular,
              os 28px de hoje de volta a partir de sm. */}
          <div className="flex flex-nowrap gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 overflow-x-auto">
            {([
              ["all", "Todos"],
              ["open", "Em aberto"],
              ["paid", "Pagos"],
              ["failed", "Com falha"],
            ] as [BillingFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setBillingFilter(value)}
                className={`shrink-0 inline-flex items-center h-10 sm:h-auto px-3 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                  billingFilter === value ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredCycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20 text-center">
              <CalendarClock className="h-10 w-10 text-zinc-600 mb-4" />
              <p className="text-zinc-400 font-medium">Nenhum vencimento neste filtro</p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...cyclesByClient.entries()].map(([clientName, cycles]) => (
                <div key={clientName} className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{clientName}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {cycles.map((cycle) => (
                      <BillingCycleCard
                        key={cycle.key}
                        cycle={cycle}
                        onConfirm={handleConfirmPayment}
                        onUndo={handleUndoPayment}
                        busy={isPending}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3 max-w-2xl">
            <h2 className="text-sm font-semibold text-zinc-200">Como funciona a cobrança automática</h2>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">1.</span>No dia do vencimento o cliente recebe o aviso. Se o vencimento cai no sábado ou no domingo, o aviso sai na segunda, com a data real do vencimento no texto.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">2.</span>Sem confirmação de pagamento, ele recebe a cobrança D+2 e, depois, a D+5. São duas cobranças e para.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">3.</span>Entre duas mensagens do mesmo vencimento sempre existem pelo menos 2 dias úteis. Feriado não adia envio, só sábado e domingo.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">4.</span>Confirmar o pagamento interrompe as cobranças daquele vencimento, emite a fatura quitada e manda o recibo por e-mail ao cliente. O honorário passa a contar como recebido no dashboard, sem precisar de lançamento à mão. Dá para confirmar por aqui ou direto no fluxo de caixa.</li>
              <li className="flex gap-2"><span className="text-indigo-400 shrink-0">5.</span>Contrato pausado ou cancelado para de ser cobrado automaticamente.</li>
            </ul>
          </div>
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
                  {/* No celular as ações descem para uma linha própria, como já
                      acontece no card de lembrete. Sem isso, três alvos de 40px na
                      mesma linha do texto espremem a mensagem do template a nada
                      numa tela de 320px. A partir de sm volta tudo para a direita. */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        {t.isDefault === "true" && (
                          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                            Mensagem padrão
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-2 whitespace-pre-wrap">{t.body}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-1 mt-3 sm:mt-0 sm:ml-4 shrink-0">
                      {t.isDefault !== "true" && (
                        <button
                          onClick={() => handleSetDefaultTemplate(t.id, t.name)}
                          disabled={isPending}
                          className="inline-flex items-center h-10 sm:h-auto px-2 sm:py-1 text-xs text-zinc-500 hover:text-green-400 rounded transition-colors disabled:opacity-50"
                          title="Definir como padrão"
                        >
                          Definir como padrão
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditTemplate(t)}
                        className="text-zinc-600 hover:text-indigo-400 flex h-10 w-10 sm:h-auto sm:w-auto sm:p-1 items-center justify-center rounded transition-colors"
                        title="Editar"
                        aria-label="Editar template"
                      >
                        <Pencil size={14} />
                      </button>
                      {t.isDefault !== "true" && (
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="text-zinc-600 hover:text-red-400 flex h-10 w-10 sm:h-auto sm:w-auto sm:p-1 items-center justify-center rounded transition-colors"
                          title="Excluir"
                          aria-label="Excluir template"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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
              {/* Mesmo X do TransactionModal: o p-3 cria o alvo de 40x40 e o -m-3
                  devolve o espaço, então o ícone não sai do lugar e o cabeçalho do
                  modal não cresce. A folga sobra dentro do p-5. */}
              <button onClick={() => setShowReminderModal(false)} aria-label="Fechar" className="flex p-3 -m-3 text-zinc-400 hover:text-zinc-200">
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

      {/* ── MODAL EDITAR TEMPLATE ── */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Editar Template</h2>
              <button onClick={() => setEditingTemplate(null)} aria-label="Fechar" className="flex p-3 -m-3 text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditTemplate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={editTemplateName}
                  onChange={(e) => setEditTemplateName(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mensagem</label>
                <textarea
                  value={editTemplateBody}
                  onChange={(e) => setEditTemplateBody(e.target.value)}
                  required
                  rows={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <p className="text-xs text-zinc-600 mt-1">Variáveis: {"{nome}"} {"{valor}"} {"{data}"} {"{dias}"}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingTemplate(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Salvar
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
              <button onClick={() => setEditingReminder(null)} aria-label="Fechar" className="flex p-3 -m-3 text-zinc-400 hover:text-zinc-200">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Novo Template</h2>
              <button onClick={() => setShowTemplateModal(false)} aria-label="Fechar" className="flex p-3 -m-3 text-zinc-400 hover:text-zinc-200">
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

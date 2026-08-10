// Envio de WhatsApp via whatsapp-service (Baileys), extraído do cron de
// lembretes (app/api/cron/send-reminders/route.ts) para ser reutilizado
// também pelo endpoint do agente (POST /api/agent/v1/reminders/:id/send-now).
// Mantém exatamente o mesmo comportamento: mesma validação de número feita
// dentro do whatsapp-service, mesmo formato de erro salvo em reminders.errorMessage.

import type { Reminder, MessageTemplate, Client, Invoice, Contract } from '@/lib/db/schema';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Mensagem usada quando nenhum template foi marcado como padrão no painel.
export const DEFAULT_TEMPLATE_BODY =
  'Olá {nome}! Passando para lembrar que o pagamento no valor de {valor} vence hoje ({data}). Qualquer dúvida, estou à disposição.';

export function resolveMessage(template: string, vars: Record<string, string>) {
  return template
    .replace(/{nome}/g, vars.nome ?? '')
    .replace(/{valor}/g, vars.valor ?? '')
    .replace(/{data}/g, vars.data ?? '')
    .replace(/{dias}/g, vars.dias ?? '');
}

export function formatBRL(value: string | null | undefined) {
  if (!value) return '';
  return `R$ ${parseFloat(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Saudação ao cliente: primeiro nome do contato (ex: "Isabela Franklin" -> "Isabela").
// Se não houver contato cadastrado, usa o nome do cliente para não ficar sem nada.
export function greetingName(contactName: string | null | undefined, clientName: string | null | undefined) {
  const contact = (contactName ?? '').trim();
  if (contact) return contact.split(/\s+/)[0]!;
  return clientName ?? 'Cliente';
}

export async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`${WPP_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WPP_KEY,
      },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (data.ok === true) return { ok: true, error: null };
    // Erro específico do serviço (ex: "WhatsApp nao conectado", "Numero X nao tem conta no WhatsApp")
    return { ok: false, error: data.error ?? 'Falha no envio via WhatsApp service' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `Erro de rede: ${err.message}` : 'Falha no envio via WhatsApp service' };
  }
}

// Resolve a mensagem final de um lembrete avulso (mesma lógica do "Passo B" do
// cron): usa customMessage se preenchida, senão monta a partir do template
// padrão substituindo {nome}, {valor}, {data} e {dias}.
export function buildReminderMessage({
  reminder,
  template,
  client,
  invoice,
  contract,
  now,
}: {
  reminder: Pick<Reminder, 'customMessage' | 'triggerDate'>;
  template: Pick<MessageTemplate, 'body'> | null;
  client: Pick<Client, 'contactName' | 'name'> | null;
  invoice: Pick<Invoice, 'dueDate' | 'amount'> | null;
  contract: Pick<Contract, 'fixedAmount'> | null;
  now: Date;
}): string {
  let message = reminder.customMessage ?? '';

  if (!message && template?.body) {
    const dueDate = invoice?.dueDate ?? reminder.triggerDate;
    const dueDateFormatted = new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const daysUntil = Math.ceil(
      (new Date(dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const valor = invoice?.amount ? formatBRL(invoice.amount) : formatBRL(contract?.fixedAmount);

    message = resolveMessage(template.body, {
      nome: greetingName(client?.contactName, client?.name),
      valor,
      data: dueDateFormatted,
      dias: daysUntil > 0 ? String(daysUntil) : '0',
    });
  }

  return message;
}

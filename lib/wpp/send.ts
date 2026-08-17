// Envio de WhatsApp via whatsapp-service (Baileys), extraído do cron de
// lembretes (app/api/cron/send-reminders/route.ts) para ser reutilizado
// também pelo endpoint do agente (POST /api/agent/v1/reminders/:id/send-now).
// Mantém exatamente o mesmo comportamento: mesma validação de número feita
// dentro do whatsapp-service, mesmo formato de erro salvo em reminders.errorMessage.

import type { Reminder, MessageTemplate, Client, Invoice, Contract, ReminderStage } from '@/lib/db/schema';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Chave Pix da agência, usada em todas as mensagens automáticas montadas aqui.
// Se ela mudar, muda em um lugar só, mas atenção: o template padrão do painel
// (tabela message_templates) tem o texto próprio dele e precisa ser editado à mão.
export const PIX_KEY = '33.336.690/0001-03';

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

export type BillingItem = { name: string; valor: string };

// Abertura e assinatura fixas de toda mensagem automática da Juliana. O corpo
// entra entre a apresentação e o "Obrigada!".
function wrapJuliana({ saudacao, corpo }: { saudacao: string; corpo: string }): string {
  return (
    `Oi ${saudacao}!\n\n` +
    `Aqui é a Juliana, assistente virtual de lembretes da Casal do Tráfego. Esta mensagem é automática.\n\n` +
    `${corpo}\n\n` +
    `Obrigada!`
  );
}

// Lista de serviços mais o valor total, usada sempre que o cliente tem dois ou
// mais contratos no mesmo vencimento.
function buildItemsBlock(items: BillingItem[], total: string): string {
  const linhas = items.map((i) => `• ${i.name}: *${i.valor}*`).join('\n');
  return `${linhas}\n\nValor total: *${total}*`;
}

// Monta uma única mensagem consolidada para um cliente com dois ou mais
// contratos vencendo no mesmo dia, listando cada serviço pelo nome e o
// valor total somado ao final. Mesmo tom, saudação, assinatura e instrução
// de Pix do template padrão do painel (Lembrete Padrao); só a frase do
// valor único vira uma lista com total. Se o template padrão mudar (ex:
// chave Pix nova), atualizar aqui também, pois este texto não lê da tabela
// message_templates.
export function buildConsolidatedMessage({
  saudacao,
  data,
  items,
  total,
}: {
  saudacao: string;
  data: string;
  items: BillingItem[];
  total: string;
}): string {
  return wrapJuliana({
    saudacao,
    corpo:
      `Hoje, ${data}, vencem os seus pagamentos:\n\n` +
      `${buildItemsBlock(items, total)}\n\n` +
      `Para facilitar, nossa chave Pix é o CNPJ *${PIX_KEY}*.\n\n` +
      `Se você já fez o pagamento, é só me avisar aqui embaixo, ou mandar o comprovante.`,
  });
}

// Aviso do vencimento adiado: o vencimento caiu no sábado ou no domingo e a
// mensagem só sai no próximo dia útil, então o texto explica o atraso e usa a
// data REAL do vencimento, não a data do envio. Texto fixo aqui no código, NÃO
// lê da tabela message_templates.
export function buildPostponedDueMessage({
  saudacao,
  data,
  items,
  total,
}: {
  saudacao: string;
  data: string;
  items: BillingItem[];
  total: string;
}): string {
  const abertura =
    items.length === 1
      ? `O seu pagamento de *${items[0]!.valor}* venceu no dia ${data}, que caiu no fim de semana, por isso estou te avisando hoje.`
      : `Os seus pagamentos venceram no dia ${data}, que caiu no fim de semana, por isso estou te avisando hoje:\n\n${buildItemsBlock(items, total)}`;

  return wrapJuliana({
    saudacao,
    corpo:
      `${abertura}\n\n` +
      `Para facilitar, nossa chave Pix é o CNPJ *${PIX_KEY}*.\n\n` +
      `Se você já fez o pagamento, é só me avisar aqui embaixo, ou mandar o comprovante.`,
  });
}

// Cobrança de atraso: D+2 (primeiro toque) e D+5 (último aviso automático).
// A data usada no texto é sempre a do VENCIMENTO, nunca a do envio. Texto fixo
// aqui no código, NÃO lê da tabela message_templates.
export function buildOverdueMessage({
  saudacao,
  data,
  items,
  total,
  stage,
}: {
  saudacao: string;
  data: string;
  items: BillingItem[];
  total: string;
  stage: 'overdue_d2' | 'overdue_d5';
}): string {
  if (stage === 'overdue_d2') {
    const abertura =
      items.length === 1
        ? `Passando para lembrar que o pagamento de *${items[0]!.valor}*, com vencimento no dia ${data}, ainda não consta como pago aqui.`
        : `Passando para lembrar que os pagamentos com vencimento no dia ${data} ainda não constam como pagos aqui:\n\n${buildItemsBlock(items, total)}`;

    return wrapJuliana({
      saudacao,
      corpo:
        `${abertura}\n\n` +
        `Para facilitar, nossa chave Pix é o CNPJ *${PIX_KEY}*.\n\n` +
        `Se você já pagou, me avisa aqui embaixo ou manda o comprovante que eu dou baixa. Se preferir combinar outra data, é só falar comigo que eu passo para a equipe.`,
    });
  }

  const abertura =
    items.length === 1
      ? `O pagamento de *${items[0]!.valor}*, com vencimento no dia ${data}, continua em aberto por aqui.`
      : `Os pagamentos com vencimento no dia ${data} continuam em aberto por aqui:\n\n${buildItemsBlock(items, total)}`;

  return wrapJuliana({
    saudacao,
    corpo:
      `${abertura}\n\n` +
      `Este é o meu último aviso automático sobre este vencimento. Se já estiver pago, me avisa que eu regularizo. Se ainda não, me responde aqui que a equipe fala com você.\n\n` +
      `Para facilitar, nossa chave Pix é o CNPJ *${PIX_KEY}*.`,
  });
}

// Reconstrói a mensagem automática de uma linha de reminders de cobrança de
// atraso (stage overdue_d2 ou overdue_d5), para o send-now do agente conseguir
// reenviar uma cobrança sem customMessage salva. Devolve null quando a linha não
// é de atraso ou não tem contrato vinculado (aí quem chama usa o caminho normal
// do buildReminderMessage). Texto fixo aqui no código, NÃO lê de message_templates.
export function buildAutomaticBillingMessage({
  reminder,
  client,
  contract,
}: {
  reminder: Pick<Reminder, 'triggerDate' | 'stage'>;
  client: Pick<Client, 'contactName' | 'name'> | null;
  contract: Pick<Contract, 'name' | 'fixedAmount'> | null;
}): string | null {
  const stage = reminder.stage as ReminderStage;
  if (stage !== 'overdue_d2' && stage !== 'overdue_d5') return null;
  if (!contract) return null;

  const valor = formatBRL(contract.fixedAmount);
  return buildOverdueMessage({
    saudacao: greetingName(client?.contactName, client?.name),
    data: new Date(reminder.triggerDate + 'T12:00:00').toLocaleDateString('pt-BR'),
    items: [{ name: (contract.name ?? '').trim() || 'Serviço', valor }],
    total: valor,
    stage,
  });
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

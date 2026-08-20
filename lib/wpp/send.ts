// Envio de WhatsApp via whatsapp-service (Baileys), extraído do cron de
// lembretes (app/api/cron/send-reminders/route.ts) para ser reutilizado
// também pelo endpoint do agente (POST /api/agent/v1/reminders/:id/send-now).
// Mantém exatamente o mesmo comportamento: mesma validação de número feita
// dentro do whatsapp-service, mesmo formato de erro salvo em reminders.errorMessage.

import type { Reminder, MessageTemplate, Client, Invoice, Contract, ReminderStage } from '@/lib/db/schema';
import { isFirstBillingFor, sendDateFor } from '@/lib/billing/schedule';

const WPP_URL = process.env.WPP_SERVICE_URL ?? '';
const WPP_KEY = process.env.WPP_API_KEY ?? '';

// Chave Pix da agência, usada em todas as mensagens automáticas montadas aqui.
// Se ela mudar, muda em um lugar só, mas atenção: o template padrão do painel
// (tabela message_templates) tem o texto próprio dele e precisa ser editado à mão.
export const PIX_KEY = '33.336.690/0001-03';

// Texto gravado em reminders.errorMessage quando o cron encontra o cliente sem
// telefone cadastrado. Fica aqui porque o cron escreve e o reenviador lê: se as
// duas pontas dessincronizarem, o reenvio manual volta a morrer sem mensagem.
export const MISSING_PHONE_ERROR = 'Cliente sem telefone cadastrado';

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

// Apresentação estendida, usada SÓ na primeira mensagem que o cliente recebe da
// Juliana. Nesse momento ela ainda é uma desconhecida mandando cobrança, então
// se apresenta pelo nome e diz o que vai fazer daqui pra frente. Da segunda
// mensagem em diante vale o wrapJuliana curto.
function wrapJulianaPrimeiroContato({ saudacao, corpo }: { saudacao: string; corpo: string }): string {
  return (
    `Oi ${saudacao}!\n\n` +
    `Meu nome é Juliana, sou a assistente virtual do Casal do Tráfego e vou cuidar dos seus lembretes de pagamento daqui pra frente. Esta mensagem é automática.\n\n` +
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

// Junta nomes de serviço em linguagem natural, já em negrito do WhatsApp:
// "*A*", "*A* e *B*", "*A*, *B* e *C*".
function joinServiceNames(names: string[]): string {
  const bold = [...new Set(names)].map((n) => `*${n}*`);
  if (bold.length <= 1) return bold[0] ?? '';
  return `${bold.slice(0, -1).join(', ')} e ${bold[bold.length - 1]!}`;
}

// PRIMEIRA cobrança de um contrato recém assinado: hoje começa a prestação do
// serviço e vence a primeira parcela. Cobre três situações com um único texto
// base, porque duplicar builder é o que faz a chave Pix divergir com o tempo:
//
// 1. Todo o grupo é estreante e o vencimento saiu no prazo: boas vindas cheias.
// 2. Todo o grupo é estreante mas o vencimento caiu no fim de semana: mesma
//    boas vindas, com a data REAL do vencimento e a explicação do adiamento.
// 3. Grupo MISTO (cliente antigo que fechou um serviço novo com o mesmo dia de
//    cobrança): abre dando as boas vindas ao serviço novo e lista TODOS os
//    pagamentos do dia com o total. Uma mensagem só, de propósito: mandar duas
//    seria dois Pix no mesmo minuto, com risco real de o cliente pagar um só.
//
// "firstNames" traz o nome dos serviços que estão estreando; "items" traz TODOS
// os do vencimento. Nome vazio já chega como "Serviço" (fallback do cron), e
// nesse caso a frase não nomeia nada em vez de dizer "o serviço de Serviço".
// Texto fixo aqui no código, NÃO lê da tabela message_templates.
export function buildFirstBillingMessage({
  saudacao,
  data,
  items,
  total,
  postponed,
  firstNames,
}: {
  saudacao: string;
  data: string;
  items: BillingItem[];
  total: string;
  postponed: boolean;
  firstNames: string[];
}): string {
  const nomeados = firstNames
    .map((n) => n.trim())
    .filter((n) => n && n.toLowerCase() !== 'serviço');
  const nomes = joinServiceNames(nomeados);
  const misto = firstNames.length < items.length;
  // No grupo misto o plural vem da quantidade de contratos ESTREANTES, não da
  // de nomes aproveitáveis: dois serviços novos em que um está sem nome
  // cadastrado continuam sendo dois.
  const plural = (misto ? firstNames.length : items.length) > 1;

  let abertura: string;
  let cobranca: string;

  if (misto) {
    const servicoNovo = plural ? 'os seus novos serviços' : 'o seu novo serviço';
    const verbo = plural ? 'começam' : 'começa';
    const complemento = nomes ? ` de ${nomes}` : '';
    const entrada = plural
      ? 'as primeiras parcelas dos contratos novos já entram'
      : 'a primeira parcela do contrato novo já entra';
    abertura = postponed
      ? `Boa notícia: ${servicoNovo}${complemento} já ${plural ? 'estão' : 'está'} rodando por aqui.`
      : `Boa notícia: a partir de hoje ${servicoNovo}${complemento} já ${verbo} a rodar por aqui.`;
    cobranca = postponed
      ? `Os seus pagamentos venceram no dia ${data}, que caiu no fim de semana, por isso estou te avisando hoje. E ${entrada} aqui:\n\n${buildItemsBlock(items, total)}`
      : `Hoje, ${data}, vencem os seus pagamentos, e ${entrada} aqui:\n\n${buildItemsBlock(items, total)}`;
  } else {
    const servico = plural ? 'os seus serviços' : 'o seu serviço';
    const verbo = plural ? 'começam' : 'começa';
    const complemento = nomes ? ` de ${nomes}` : '';
    abertura = postponed
      ? `Seja muito bem-vindo! ${plural ? 'Os seus serviços' : 'O seu serviço'}${complemento} já ${plural ? 'estão' : 'está'} rodando por aqui.`
      : `Seja muito bem-vindo! A partir de hoje ${servico}${complemento} já ${verbo} a rodar por aqui.`;

    if (postponed) {
      cobranca = plural
        ? `As primeiras parcelas do seu contrato venceram no dia ${data}, que caiu no fim de semana, por isso estou te avisando hoje:\n\n${buildItemsBlock(items, total)}`
        : `A primeira parcela do seu contrato, no valor de *${items[0]!.valor}*, venceu no dia ${data}, que caiu no fim de semana, por isso estou te avisando hoje.`;
    } else {
      cobranca = plural
        ? `Para fechar essa primeira etapa, hoje, ${data}, vencem as primeiras parcelas do seu contrato:\n\n${buildItemsBlock(items, total)}`
        : `Para fechar essa primeira etapa, hoje, ${data}, vence a primeira parcela do seu contrato, no valor de *${items[0]!.valor}*.`;
    }
  }

  // Grupo misto é cliente antigo, que já recebeu mensagem da Juliana em outros
  // vencimentos: ela não se apresenta de novo. Só o estreante puro leva a
  // apresentação completa.
  const wrap = misto ? wrapJuliana : wrapJulianaPrimeiroContato;

  return wrap({
    saudacao,
    corpo:
      `${abertura}\n\n` +
      `${cobranca}\n\n` +
      `Assim que o pagamento cair, seguimos com tudo.\n\n` +
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

// Reconstrói a mensagem automática de uma linha de reminders para o send-now do
// agente conseguir reenviar sem customMessage salva. Cobre as etapas de atraso
// (overdue_d2, overdue_d5) e os dois casos de vencimento que NÃO saem do template
// do painel: primeira parcela e vencimento adiado por fim de semana. Devolve null
// quando é vencimento comum, quando não é etapa conhecida ou quando não há
// contrato vinculado; aí quem chama usa o caminho normal do buildReminderMessage,
// que lê o template padrão.
//
// O reenvio de vencimento normal cai no template do painel de propósito: é lá que
// o dono edita o texto. A linha típica sem customMessage é a que o cron cria como
// falha quando o cliente está sem telefone cadastrado, cenário comum justamente
// em contrato recém assinado.
//
// Diferente do cron, aqui não há como conferir se o contrato tem histórico de
// lembretes anteriores, então um contrato antigo cadastrado com startDate recente
// pode reenviar o texto de boas vindas. É reenvio manual e pontual, o dono vê o
// que saiu no painel.
export function buildAutomaticBillingMessage({
  reminder,
  client,
  contract,
}: {
  reminder: Pick<Reminder, 'triggerDate' | 'stage'>;
  client: Pick<Client, 'contactName' | 'name'> | null;
  contract: Pick<Contract, 'name' | 'fixedAmount' | 'startDate' | 'billingDay'> | null;
}): string | null {
  const stage = reminder.stage as ReminderStage;
  if (!contract) return null;

  const valor = formatBRL(contract.fixedAmount);
  const saudacao = greetingName(client?.contactName, client?.name);
  const nome = (contract.name ?? '').trim() || 'Serviço';
  const items = [{ name: nome, valor }];
  const data = new Date(reminder.triggerDate + 'T12:00:00').toLocaleDateString('pt-BR');

  if (stage === 'due') {
    const dueIso = reminder.triggerDate;
    const postponed = sendDateFor(dueIso, 'due') !== dueIso;

    if (isFirstBillingFor(dueIso, contract.startDate, contract.billingDay)) {
      return buildFirstBillingMessage({
        saudacao,
        data,
        items,
        total: valor,
        postponed,
        firstNames: [nome],
      });
    }
    if (postponed) return buildPostponedDueMessage({ saudacao, data, items, total: valor });
    return null;
  }

  if (stage !== 'overdue_d2' && stage !== 'overdue_d5') return null;

  return buildOverdueMessage({
    saudacao,
    data,
    items,
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

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  BillingNotFoundError,
  BillingValidationError,
  cancelPendingDunning,
  confirmPayment,
  getBillingCycle,
  listOpenDues,
  unconfirmPayment,
} from '@/lib/billing/confirmations';
import { notFound, badRequest, conflict } from '../errors';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar no formato YYYY-MM-DD');

// "source" NUNCA vem do body: quem chama esta rota é o agente, ponto. Quem
// confirma pelo painel passa por app/(dashboard)/reminders/actions.ts.
const confirmSchema = z
  .object({
    contractId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
    phone: z.string().min(8).optional(),
    dueDate: isoDate.optional(),
    amount: z.union([z.number(), z.string()]).nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => Boolean(v.contractId || v.clientId || v.phone), {
    message: 'informe contractId, clientId ou phone',
  });

const unconfirmSchema = z.object({
  contractId: z.string().uuid(),
  dueDate: isoDate,
});

const openDuesSchema = z
  .object({
    contractId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
    phone: z.string().min(8).optional(),
    days: z.number().int().min(1).max(120).default(45),
  })
  .refine((v) => Boolean(v.contractId || v.clientId || v.phone), {
    message: 'informe contractId, clientId ou phone',
  });

const dunningStatusSchema = z.object({
  contractId: z.string().uuid(),
  dueDate: isoDate.optional(),
});

// Converte os erros do módulo de cobrança nos erros HTTP da API do agente.
function toAgentError(err: unknown): never {
  if (err instanceof BillingNotFoundError) throw notFound(err.message);
  if (err instanceof BillingValidationError) throw badRequest(err.message);
  throw err;
}

export async function confirmPaymentService(input: unknown, actor: string) {
  const parsed = confirmSchema.parse(input);

  let contractId = parsed.contractId;
  let dueDate = parsed.dueDate;

  // Sem contrato e data explícitos, resolve pelo que está em aberto na janela
  // de 45 dias. Mais de um contrato em aberto é ambiguidade: a API não adivinha
  // qual foi pago, devolve 409 e o agente escolhe.
  if (!contractId || !dueDate) {
    const dues = (
      await listOpenDues({
        contractId: parsed.contractId,
        clientId: parsed.clientId,
        phone: parsed.phone,
        days: 45,
      })
    ).filter((d) => !d.confirmed && (!dueDate || d.dueDate === dueDate));

    if (dues.length === 0) throw notFound('Vencimento em aberto');

    const opcoes = dues
      .map((d) => `${d.contractName ?? 'Contrato'} (${d.contractId}, vencimento ${d.dueDate})`)
      .join('; ');

    const contratos = new Set(dues.map((d) => d.contractId));
    if (contratos.size > 1) {
      throw conflict(
        `Mais de um vencimento em aberto para este alvo. Informe contractId e dueDate. Opções: ${opcoes}`
      );
    }

    // Um contrato só, mas ainda pode haver dois meses em aberto (cliente
    // atrasado). Escolher o mais recente em silêncio daria baixa no mês errado,
    // então também é ambiguidade: quem confirma precisa dizer qual vencimento.
    if (!dueDate && dues.length > 1) {
      throw conflict(
        `Este contrato tem ${dues.length} vencimentos em aberto. Informe dueDate. Opções: ${opcoes}`
      );
    }

    const escolhido = dues[0]!;
    contractId = escolhido.contractId;
    dueDate = dueDate ?? escolhido.dueDate;
  }

  try {
    const { confirmation, alreadyConfirmed } = await confirmPayment({
      contractId,
      dueDate,
      amount: parsed.amount ?? null,
      source: 'agent',
      actor,
      note: parsed.note ?? null,
    });

    const dunningCancelled = await cancelPendingDunning(contractId, dueDate);
    revalidatePath('/reminders');
    return { confirmation, alreadyConfirmed, dunningCancelled, contractId, dueDate };
  } catch (err) {
    return toAgentError(err);
  }
}

// Sem resolução por telefone de propósito: desfazer confirmação é operação de
// correção, exige o alvo exato.
export async function unconfirmPaymentService(input: unknown) {
  const parsed = unconfirmSchema.parse(input);
  try {
    const result = await unconfirmPayment(parsed);
    revalidatePath('/reminders');
    return result;
  } catch (err) {
    return toAgentError(err);
  }
}

export async function listOpenDuesService(input: unknown, { limit, offset }: { limit: number; offset: number }) {
  const parsed = openDuesSchema.parse(input);
  try {
    const all = await listOpenDues(parsed);
    return { data: all.slice(offset, offset + limit), count: all.length };
  } catch (err) {
    return toAgentError(err);
  }
}

export async function getDunningStatusService(input: unknown) {
  const parsed = dunningStatusSchema.parse(input);

  let dueDate = parsed.dueDate;
  if (!dueDate) {
    const dues = await listOpenDues({ contractId: parsed.contractId, days: 45 });
    if (dues.length === 0) throw notFound('Vencimento deste contrato');
    dueDate = dues[0]!.dueDate; // listOpenDues já vem do mais recente para o mais antigo
  }

  try {
    return await getBillingCycle(parsed.contractId, dueDate);
  } catch (err) {
    return toAgentError(err);
  }
}

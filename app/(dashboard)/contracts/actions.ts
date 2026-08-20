'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  ContractPdfError,
  deleteContractPdfIfOurs,
  uploadContractPdf,
} from '@/lib/storage/contractPdf';
import {
  createContract,
  updateContract,
  deleteContract,
  getContractById,
  isPdfUrlUsedByOtherContract,
  getUser,
} from '@/lib/db/queries';

const contractSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().optional(),
  type: z.enum(['fixed_fee', 'fixed_plus_percentage', 'project']),
  fixedAmount: z.string().transform((v) => v.replace(',', '.')),
  percentage: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  adBudget: z.string().optional().transform((v) => v?.replace(',', '.') || null),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  billingDay: z.coerce.number().min(1).max(31).default(5),
  startDate: z.string().min(1),
  endDate: z.string().optional().transform((v) => v || null),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  description: z.string().optional(),
});

// Usa o mesmo helper da API do agente (lib/storage/contractPdf.ts), então o
// painel também passou a recusar arquivo que não é PDF de verdade e a gerar
// pathname com sufixo aleatório, em vez de data mais nome do arquivo.
//
// Devolve `undefined` quando nenhum arquivo foi enviado, e quem chama traduz
// isso como "não encosta no pdfUrl atual". Antes o formulário mandava de volta
// um campo oculto com a URL lida na hora em que a página foi renderizada, e
// gravar aquele valor de novo era perigoso: duas abas abertas no mesmo contrato,
// uma trocando o PDF e a outra salvando qualquer outro campo, faziam a segunda
// reescrever o `pdfUrl` com um arquivo que a primeira já tinha apagado.
async function uploadPdfIfPresent(
  formData: FormData,
  contractId: string
): Promise<string | undefined> {
  const file = formData.get('pdfFile') as File | null;
  if (file && file.size > 0) {
    const { url } = await uploadContractPdf(file, contractId);
    return url;
  }
  return undefined;
}

// Erro de PDF vira mensagem na própria tela do formulário. Sem isso, o operador
// que sobe um arquivo que não é PDF cai no erro genérico de Server Action, que
// em produção esconde a mensagem e ainda perde o que ele já tinha preenchido.
function pdfErrorRedirect(destino: string, err: unknown): never {
  const mensagem = err instanceof ContractPdfError ? err.message : 'Falha ao enviar o PDF';
  redirect(`${destino}?erroPdf=${encodeURIComponent(mensagem)}`);
}

export async function createContractAction(formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => k !== 'pdfFile')
  );
  const parsed = contractSchema.parse(raw);
  // O contrato ainda não existe aqui, então o id só serviria de fallback para o
  // nome do arquivo; "novo" é suficiente e o pathname ganha sufixo aleatório.
  let pdfUrl: string | undefined;
  try {
    pdfUrl = await uploadPdfIfPresent(formData, 'novo');
  } catch (err) {
    if (err instanceof ContractPdfError) pdfErrorRedirect('/contracts/new', err);
    throw err;
  }

  try {
    await createContract({
      clientId: parsed.clientId,
      name: parsed.name ?? null,
      type: parsed.type,
      fixedAmount: parsed.fixedAmount,
      percentage: parsed.percentage ?? null,
      adBudget: parsed.adBudget ?? null,
      currency: parsed.currency,
      billingDay: parsed.billingDay,
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
      status: parsed.status,
      description: parsed.description ?? null,
      pdfUrl: pdfUrl ?? null,
    });
  } catch (err) {
    // O arquivo já subiu mas o contrato não gravou: sem isso o blob fica órfão
    // no storage para sempre, sem nenhuma linha do banco apontando para ele.
    if (pdfUrl) await deleteContractPdfIfOurs(pdfUrl);
    throw err;
  }
  revalidatePath('/contracts');
  redirect('/contracts');
}

export async function updateContractAction(id: string, formData: FormData): Promise<void> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([k]) => k !== 'pdfFile')
  );
  const parsed = contractSchema.parse(raw);

  let novoPdfUrl: string | undefined;
  try {
    novoPdfUrl = await uploadPdfIfPresent(formData, id);
  } catch (err) {
    if (err instanceof ContractPdfError) pdfErrorRedirect(`/contracts/${id}`, err);
    throw err;
  }

  // Estado ATUAL do banco, não o que a página tinha quando foi renderizada.
  const atual = await getContractById(id);
  const pdfAntigo = atual?.pdfUrl ?? null;

  try {
    await updateContract(id, {
      clientId: parsed.clientId,
      name: parsed.name ?? null,
      type: parsed.type,
      fixedAmount: parsed.fixedAmount,
      percentage: parsed.percentage ?? null,
      adBudget: parsed.adBudget ?? null,
      currency: parsed.currency,
      billingDay: parsed.billingDay,
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
      status: parsed.status,
      description: parsed.description ?? null,
      // Sem arquivo novo, o campo nem entra no UPDATE e o PDF atual fica intacto.
      ...(novoPdfUrl !== undefined && { pdfUrl: novoPdfUrl }),
    });
  } catch (err) {
    if (novoPdfUrl) await deleteContractPdfIfOurs(novoPdfUrl);
    throw err;
  }

  // PDF trocado nesta edição: o arquivo anterior vira lixo no Blob, apaga. Só
  // depois de conferir que nenhum outro contrato aponta para o mesmo arquivo.
  if (novoPdfUrl !== undefined && pdfAntigo && pdfAntigo !== novoPdfUrl) {
    if (!(await isPdfUrlUsedByOtherContract(pdfAntigo, id))) {
      await deleteContractPdfIfOurs(pdfAntigo);
    }
  }
  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  redirect('/contracts');
}

export type DeleteContractState = {
  error?: string;
};

export async function deleteContractAction(
  id: string,
  _prevState: DeleteContractState,
  _formData: FormData
): Promise<DeleteContractState> {
  // TODO: filtrar por teamId quando o banco virar multi-tenant
  const user = await getUser();
  if (!user) throw new Error('Unauthenticated');
  try {
    await deleteContract(id);
  } catch (err) {
    console.error('Erro ao excluir contrato:', err);
    return { error: 'Não foi possível excluir o contrato. Tente novamente em instantes ou contate o suporte.' };
  }
  revalidatePath('/contracts');
  redirect('/contracts');
}

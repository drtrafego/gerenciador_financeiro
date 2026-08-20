import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, contracts } from '@/lib/db/schema';
import {
  getContractById,
  createContract,
  updateContract,
  isPdfUrlUsedByOtherContract,
} from '@/lib/db/queries';
import {
  ContractPdfError,
  deleteContractPdfIfOurs,
  isOurBlobUrl,
  readContractPdf,
  uploadContractPdf,
} from '@/lib/storage/contractPdf';
import { badRequest, externalFile, notFound, payloadTooLarge } from '../errors';

// No POST e no PATCH, pdfUrl só aceita link já hospedado. Para mandar o arquivo
// em si existe POST /contracts/:id/pdf (multipart), ver attachContractPdfService
// no fim deste arquivo.
// fixedAmount/percentage/adBudget aceitam string ou number, trocam vírgula por
// ponto e validam que o resultado é um número válido antes de virar 400 claro
// em vez de estourar um 500 genérico no insert do Postgres (ex: "1.234,56" não
// vira "1.234.56" sem detecção).
const contractCreateSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().nullable().optional(),
  type: z.enum(['fixed_fee', 'fixed_plus_percentage', 'project']),
  fixedAmount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(',', '.'))
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, { message: 'fixedAmount deve ser um número válido maior ou igual a zero' }),
  percentage: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((v) => (v == null ? null : String(v).replace(',', '.')))
    .refine((v) => v == null || (!isNaN(Number(v)) && Number(v) >= 0), { message: 'percentage deve ser um número válido maior ou igual a zero' }),
  adBudget: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((v) => (v == null ? null : String(v).replace(',', '.')))
    .refine((v) => v == null || (!isNaN(Number(v)) && Number(v) >= 0), { message: 'adBudget deve ser um número válido maior ou igual a zero' }),
  currency: z.enum(['BRL', 'USD', 'ARS']).default('BRL'),
  billingDay: z.coerce.number().int().min(1).max(31).default(5),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
  description: z.string().nullable().optional(),
  pdfUrl: z.string().url().nullable().optional(),
});

const contractUpdateSchema = contractCreateSchema.partial();

export async function listContracts({ limit, offset }: { limit: number; offset: number }) {
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ contract: contracts, clientName: clients.name })
      .from(contracts)
      .leftJoin(clients, eq(contracts.clientId, clients.id))
      .orderBy(desc(contracts.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contracts),
  ]);
  return { data: rows, count: Number(count) };
}

export async function getContractDetail(id: string) {
  const contract = await getContractById(id);
  if (!contract) throw notFound('Contrato');
  return contract;
}

export async function createContractService(input: unknown) {
  const parsed = contractCreateSchema.parse(input);
  const contract = await createContract({
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
    pdfUrl: parsed.pdfUrl ?? null,
  });
  revalidatePath('/contracts');
  return { contract, parsed };
}

export async function updateContractService(id: string, input: unknown) {
  const before = await getContractById(id);
  if (!before) throw notFound('Contrato');

  const parsed = contractUpdateSchema.parse(input);
  const contract = await updateContract(id, {
    ...(parsed.clientId !== undefined && { clientId: parsed.clientId }),
    ...(parsed.name !== undefined && { name: parsed.name ?? null }),
    ...(parsed.type !== undefined && { type: parsed.type }),
    ...(parsed.fixedAmount !== undefined && { fixedAmount: parsed.fixedAmount }),
    ...(parsed.percentage !== undefined && { percentage: parsed.percentage ?? null }),
    ...(parsed.adBudget !== undefined && { adBudget: parsed.adBudget ?? null }),
    ...(parsed.currency !== undefined && { currency: parsed.currency }),
    ...(parsed.billingDay !== undefined && { billingDay: parsed.billingDay }),
    ...(parsed.startDate !== undefined && { startDate: parsed.startDate }),
    ...(parsed.endDate !== undefined && { endDate: parsed.endDate ?? null }),
    ...(parsed.status !== undefined && { status: parsed.status }),
    ...(parsed.description !== undefined && { description: parsed.description ?? null }),
    ...(parsed.pdfUrl !== undefined && { pdfUrl: parsed.pdfUrl ?? null }),
  });
  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  return { before, after: contract, parsed };
}

// Lê o PDF do contrato para download. O arquivo fica em storage privado, então a
// URL gravada em pdfUrl não abre sozinha: quem entrega o conteúdo é o servidor,
// depois de o chamador ter passado pelo Bearer e pela allowlist de IP.
export async function getContractPdfService(id: string) {
  const contract = await getContractById(id);
  if (!contract) throw notFound('Contrato');
  if (!contract.pdfUrl) throw notFound('PDF do contrato');

  // Link de outro serviço colado via PATCH: não é nosso arquivo e não viramos
  // proxy de domínio arbitrário. Quem chamou baixa direto da fonte.
  if (!isOurBlobUrl(contract.pdfUrl)) {
    throw externalFile(`O PDF deste contrato está hospedado fora do sistema: ${contract.pdfUrl}`);
  }

  const arquivo = await readContractPdf(contract.pdfUrl);
  if (!arquivo) throw notFound('PDF do contrato');

  return { contract, arquivo };
}

// Anexa o PDF assinado ao contrato: sobe o arquivo no Vercel Blob e grava a URL
// em pdfUrl. Substitui o PDF anterior (contrato reassinado é o caso comum) e
// apaga o blob antigo depois, se ele for nosso.
//
// A ordem importa: contrato conferido ANTES do upload, para não deixar arquivo
// órfão no storage quando o id não existe; e se o UPDATE falhar depois do
// upload, o arquivo novo é apagado antes de propagar o erro.
export async function attachContractPdfService(id: string, file: File) {
  const before = await getContractById(id);
  if (!before) throw notFound('Contrato');

  let uploaded;
  try {
    uploaded = await uploadContractPdf(file, id);
  } catch (err) {
    if (err instanceof ContractPdfError) {
      throw err.status === 413 ? payloadTooLarge(err.message) : badRequest(err.message);
    }
    throw err;
  }

  let contract;
  try {
    contract = await updateContract(id, { pdfUrl: uploaded.url });
  } catch (err) {
    await deleteContractPdfIfOurs(uploaded.url);
    throw err;
  }

  // Só apaga o anterior se nenhum outro contrato estiver apontando para o mesmo
  // arquivo: pdf_url não é único e o PATCH aceita colar qualquer link.
  const replacedUrl = before.pdfUrl ?? null;
  if (replacedUrl && replacedUrl !== uploaded.url) {
    if (!(await isPdfUrlUsedByOtherContract(replacedUrl, id))) {
      await deleteContractPdfIfOurs(replacedUrl);
    }
  }

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  return { before, after: contract, uploaded, replacedUrl };
}

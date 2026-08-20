// Upload do PDF de contrato no Vercel Blob, compartilhado pelo formulário do
// painel e pelo endpoint da API do agente. Ficar em um lugar só importa porque
// as duas pontas precisam da MESMA validação: antes disso, o painel aceitava
// qualquer arquivo renomeado para .pdf.
//
// O arquivo vai para o Blob PÚBLICO (link não listável, mas quem tem a URL abre
// sem autenticação). É como o painel sempre funcionou. O `addRandomSuffix` fecha
// o buraco de a URL ser adivinhável: antes o pathname era só a data mais o nome
// do arquivo, então quem soubesse o nome podia chutar o timestamp.
//
// Para tornar o PDF realmente privado seria preciso `access: 'private'` mais
// trocar o redirect de /api/contracts/pdf por stream, porque este SDK
// (@vercel/blob 2.x) não gera URL assinada com expiração. Decisão pendente do
// dono: privado protege o documento, mas o link deixa de abrir fora do painel,
// inclusive para o agente externo.

import { del, put } from '@vercel/blob';
import { createHash } from 'crypto';

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // teto real de body de uma function na Vercel é ~4,5MB

export class ContractPdfError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Só o header conta: content-type declarado é palpite do chamador. Alguns PDFs
// reais trazem lixo antes do "%PDF-", por isso a busca não é presa ao offset 0.
function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 1024).toString('latin1').includes('%PDF-');
}

// O nome vem de fora (formulário do painel ou curl do agente) e vira caminho de
// storage, então nada de barra, "..", acento ou nome gigante.
function sanitizeFileName(rawName: string | null | undefined, fallbackId: string): string {
  const base = (rawName ?? '').split(/[\\/]/).pop() ?? '';
  const semExtensao = base.replace(/(\.pdf)+$/i, '');
  const limpo = semExtensao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);
  return `${limpo || `contrato-${fallbackId}`}.pdf`;
}

// Compara o HOSTNAME, não o texto da URL: um link de terceiros com o domínio do
// Blob na query string passaria num includes() e viraria uma tentativa de apagar
// arquivo que não é nosso.
function isOurBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export type UploadedContractPdf = {
  url: string;
  pathname: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
};

// Valida e sobe o arquivo. Lança ContractPdfError com o status HTTP certo:
// 400 para arquivo ausente ou que não é PDF, 413 para arquivo grande demais.
export async function uploadContractPdf(file: File, contractId: string): Promise<UploadedContractPdf> {
  if (!file || file.size === 0) {
    throw new ContractPdfError(400, 'Arquivo ausente ou vazio');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new ContractPdfError(
      413,
      `Arquivo de ${(file.size / 1024 / 1024).toFixed(1)}MB excede o limite de ${MAX_PDF_BYTES / 1024 / 1024}MB`
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isPdf(bytes)) {
    throw new ContractPdfError(400, 'O arquivo enviado não é um PDF');
  }

  const fileName = sanitizeFileName(file.name, contractId);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const { url, pathname } = await put(`contracts/${fileName}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });

  return { url, pathname, fileName, sizeBytes: file.size, sha256 };
}

// Apaga um PDF que foi substituído. Só mexe no que é nosso: pdfUrl pode ter sido
// preenchido com um link externo qualquer via PATCH, e apagar ali não faria
// sentido nenhum. Falha de exclusão nunca derruba a operação principal, o pior
// caso é um arquivo órfão no Blob.
export async function deleteContractPdfIfOurs(url: string | null | undefined): Promise<void> {
  if (!url || !isOurBlobUrl(url)) return;
  try {
    await del(url);
  } catch (err) {
    console.error('[contract-pdf] falha ao apagar blob substituído:', err);
  }
}

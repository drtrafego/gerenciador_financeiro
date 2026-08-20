// Upload do PDF de contrato no Vercel Blob, compartilhado pelo formulário do
// painel e pelo endpoint da API do agente. Ficar em um lugar só importa porque
// as duas pontas precisam da MESMA validação: antes disso, o painel aceitava
// qualquer arquivo renomeado para .pdf.
//
// O arquivo vai para o Blob PRIVADO, por decisão do dono: contrato assinado tem
// CPF, endereço e assinatura, e um link que abre sem autenticação vaza inteiro se
// escapar num print ou numa conversa.
//
// Consequência que vale ter em mente antes de mexer aqui: a URL gravada em
// contracts.pdf_url NÃO abre sozinha em lugar nenhum. Ela é identificador do
// blob, não link. Quem lê o arquivo é o servidor, pelo readContractPdf, e entrega
// para quem já provou quem é: o painel por sessão, o agente pelo Bearer mais a
// allowlist de IP. Este SDK (@vercel/blob 2.x) não gera link assinado com
// validade, então mandar um contrato para fora do sistema virou feature nova, não
// ajuste de configuração.

import { del, get, put } from '@vercel/blob';
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
export function isOurBlobUrl(url: string): boolean {
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
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });

  return { url, pathname, fileName, sizeBytes: file.size, sha256 };
}

export type ContractPdfContent = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  sizeBytes: number;
};

// Lê o arquivo do Blob privado para quem já foi autenticado por quem chamou.
// Devolve `null` quando o blob não existe mais (o SDK retorna null em vez de
// lançar), para virar 404 em vez de 500.
//
// O stream é repassado sem buffer: um PDF de 4MB não passa pela memória da
// function inteira, e o `headers` que o SDK devolve NÃO é o Headers global, por
// isso quem chama monta os próprios cabeçalhos.
export async function readContractPdf(url: string): Promise<ContractPdfContent | null> {
  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    sizeBytes: result.blob.size,
  };
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

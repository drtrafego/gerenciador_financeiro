import { withAgentAuth } from '@/lib/agent/route';
import { badRequest } from '@/lib/agent/errors';
import { attachContractPdfService } from '@/lib/agent/services/contracts';

// ÚNICO endpoint multipart da API do agente. Todos os outros são JSON.
//
//   curl -X POST "$BASE/api/agent/v1/contracts/$ID/pdf" \
//        -H "Authorization: Bearer $AGENT_API_KEY" \
//        -F "file=@contrato-assinado.pdf"
//
// O content-type é conferido antes de tocar em request.formData(), porque com
// corpo não multipart o formData() lança TypeError e isso viraria um 500 genérico
// em vez do 400 que o chamador precisa ler.
//
// Nada do binário entra no audit log: só nome, tamanho e sha256, o suficiente
// para provar depois QUAL arquivo foi anexado sem guardar um byte dele.
export const POST = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw badRequest('Envie o arquivo como multipart/form-data no campo "file"');
  }

  // Corpo multipart corrompido lança aqui mesmo com o content-type certo, e sem
  // este catch viraria 500 genérico em vez de dizer ao chamador o que houve.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw badRequest('Corpo multipart inválido ou corrompido');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw badRequest('Campo "file" ausente ou não é um arquivo');
  }

  const { before, after, uploaded, replacedUrl } = await attachContractPdfService(params.id, file);

  return {
    status: 200,
    body: {
      contract: after,
      pdf: {
        url: uploaded.url,
        pathname: uploaded.pathname,
        sizeBytes: uploaded.sizeBytes,
        sha256: uploaded.sha256,
        replacedUrl,
      },
    },
    resourceType: 'contract',
    resourceId: params.id,
    requestBody: {
      fileName: uploaded.fileName,
      sizeBytes: uploaded.sizeBytes,
      sha256: uploaded.sha256,
      declaredContentType: file.type || null,
      replaced: replacedUrl !== null,
    },
    beforeData: before,
    afterData: after,
  };
});

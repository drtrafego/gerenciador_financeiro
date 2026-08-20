import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/db/queries";
import { isOurBlobUrl, readContractPdf } from "@/lib/storage/contractPdf";

// GET /api/contracts/pdf?id=<contractId>
//
// Entrega o conteúdo do PDF, não um link. Antes esta rota redirecionava para o
// Blob público, o que colocava a URL aberta na barra de endereços do navegador e
// deixava o contrato acessível a qualquer um que copiasse aquele endereço. Agora
// o arquivo é privado e só sai por aqui, para quem tem sessão no painel.
//
// O redirect continua existindo para um caso vivo: pdf_url pode guardar um link
// de outro serviço, colado via PATCH da API do agente. Esse arquivo não é nosso
// e não temos como servir o conteúdo dele.
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const [contract] = await db.select({ pdfUrl: contracts.pdfUrl }).from(contracts).where(eq(contracts.id, id));
  if (!contract?.pdfUrl) return new NextResponse("PDF não encontrado", { status: 404 });

  if (!isOurBlobUrl(contract.pdfUrl)) {
    return NextResponse.redirect(contract.pdfUrl);
  }

  // Blob inexistente devolve null, mas falha de infraestrutura (token ausente na
  // Vercel, storage fora do ar) lança, e sem este catch o operador veria a tela
  // de erro genérica do Next em vez de uma mensagem desta rota.
  let arquivo;
  try {
    arquivo = await readContractPdf(contract.pdfUrl);
  } catch (err) {
    console.error("[contracts-pdf] falha ao ler o arquivo no storage:", err);
    return new NextResponse("Erro ao carregar o PDF", { status: 502 });
  }
  if (!arquivo) return new NextResponse("PDF não encontrado", { status: 404 });

  return new NextResponse(arquivo.stream, {
    headers: {
      "Content-Type": arquivo.contentType,
      // Abre na aba, como sempre abriu pelo painel.
      "Content-Disposition": `inline; filename="contrato-${id}.pdf"`,
      "Content-Length": String(arquivo.sizeBytes),
      // Documento com dado pessoal nunca entra em cache compartilhado.
      "Cache-Control": "private, no-store",
      // Antes quem servia o arquivo era a CDN do Blob, com os headers dela.
      // Agora a resposta é montada aqui, então o nosniff vem junto.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

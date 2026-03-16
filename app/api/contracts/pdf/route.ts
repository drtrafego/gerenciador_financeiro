import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/contracts/pdf?id=<contractId>
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const [contract] = await db.select({ pdfUrl: contracts.pdfUrl }).from(contracts).where(eq(contracts.id, id));
  if (!contract?.pdfUrl) return new NextResponse("PDF não encontrado", { status: 404 });

  // Busca o blob privado usando o token do servidor
  const blobRes = await fetch(contract.pdfUrl, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
  });

  if (!blobRes.ok) return new NextResponse("Erro ao acessar o arquivo", { status: 502 });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline; filename=\"contrato.pdf\"");

  return new NextResponse(blobRes.body, { headers });
}

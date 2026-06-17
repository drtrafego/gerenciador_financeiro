import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/db/queries";

// GET /api/contracts/pdf?id=<contractId>
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const [contract] = await db.select({ pdfUrl: contracts.pdfUrl }).from(contracts).where(eq(contracts.id, id));
  if (!contract?.pdfUrl) return new NextResponse("PDF não encontrado", { status: 404 });

  return NextResponse.redirect(contract.pdfUrl);
}

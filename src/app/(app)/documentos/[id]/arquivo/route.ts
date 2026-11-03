import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { metaRequisicao, usuarioAtual } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { baixarDocumento } from "@/server/services/documentos";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = { PROIBIDO: 403, NAO_ENCONTRADO: 404, VALIDACAO: 400 };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u || u.trocarSenha) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  const { id } = await params;
  try {
    const d = await baixarDocumento(prisma, u, id, await metaRequisicao());
    const ascii = d.nome.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "documento";
    return new NextResponse(new Uint8Array(d.conteudo), {
      headers: {
        "Content-Type": d.tipo,
        "Content-Length": String(d.conteudo.length),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(d.nome)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ erro: e.message }, { status: STATUS[e.code] ?? 400 });
    throw e;
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { metaRequisicao, usuarioAtual } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { gerarRelatorio, registrarExportacao, type FiltrosRelatorio } from "@/server/services/relatorios";
import { gerarExcel } from "@/server/relatorios/excel";
import { gerarPDF } from "@/server/relatorios/pdf";
import { ehFormato, ehTipoRelatorio, nomeArquivo, paraCSV } from "@/lib/relatorios";
import { hojeISO } from "@/lib/demandas";

export const dynamic = "force-dynamic";

const MIME = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

const CAMPOS: (keyof FiltrosRelatorio)[] = ["de", "ate", "status", "regionalId", "temaId", "responsavel", "esfera", "ano", "pessoais"];

export async function GET(req: NextRequest) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.redirect(new URL("/login", req.url));
  if (u.trocarSenha) return NextResponse.redirect(new URL("/trocar-senha", req.url));

  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo");
  const formato = sp.get("formato");
  if (!ehTipoRelatorio(tipo) || !ehFormato(formato)) return new NextResponse("Relatório ou formato inválido.", { status: 400 });
  const f: FiltrosRelatorio = {};
  for (const k of CAMPOS) {
    const v = sp.get(k);
    if (v) f[k] = v.slice(0, 64);
  }

  try {
    const r = await gerarRelatorio(prisma, u, tipo, f);
    const corpo = formato === "csv" ? Buffer.from(paraCSV(r), "utf8") : formato === "xlsx" ? await gerarExcel(r) : await gerarPDF(r);
    await registrarExportacao(prisma, u, tipo, formato, f, r, (await metaRequisicao()).ip);
    return new NextResponse(new Uint8Array(corpo), {
      headers: {
        "Content-Type": MIME[formato],
        "Content-Disposition": `attachment; filename="${nomeArquivo(tipo, formato, hojeISO())}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new NextResponse(e.message, { status: e.code === "PROIBIDO" ? 403 : 400 });
    throw e;
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { usuarioAtual } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { geocodificar } from "@/server/services/geocodificar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await usuarioAtual();
  if (!u || u.trocarSenha) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  if (!pode(u, "dados:criar")) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const endereco = (req.nextUrl.searchParams.get("endereco") ?? "").trim().slice(0, 200);
  const bairroId = req.nextUrl.searchParams.get("bairroId") ?? "";
  if (endereco.length < 3) return NextResponse.json({ erro: "Preencha o endereço antes de localizar." }, { status: 400 });
  const bairro = /^\d+$/.test(bairroId) ? await prisma.bairro.findUnique({ where: { id: Number(bairroId) }, select: { nome: true } }) : null;
  try {
    const r = await geocodificar(endereco, bairro?.nome);
    if (!r) return NextResponse.json({ erro: "Endereço não encontrado em BH. Clique no mapa para marcar o ponto." }, { status: 404 });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ erro: "Busca de endereço indisponível agora. Clique no mapa para marcar o ponto." }, { status: 502 });
  }
}

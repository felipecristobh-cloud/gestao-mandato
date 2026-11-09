import { NextResponse } from "next/server";
import { usuarioAtual } from "@/server/auth/current";
import { CABECALHO_MODELO } from "@/server/proposicoes/planilha";

export const dynamic = "force-dynamic";

const EXEMPLO = [
  "PL", "123", "2021", "Ementa como consta no portal da Câmara", "Autoria", "Portal CMBH", "Aguardando conferência", "Educação", "15/03/2021",
  "Em tramitação", "https://www.cmbh.mg.gov.br/...", "", "", "", "", "", "", "", "", "Linha de exemplo: apague antes de importar",
];

const csv = (l: string[]) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";");

export async function GET() {
  const u = await usuarioAtual();
  if (!u || u.trocarSenha) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  return new NextResponse(`\uFEFF${csv(CABECALHO_MODELO)}\r\n${csv(EXEMPLO)}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-historico-legislativo.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}

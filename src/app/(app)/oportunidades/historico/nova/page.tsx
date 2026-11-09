import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesProposicao } from "@/server/services/proposicoes";
import { criarProposicaoAction } from "@/server/services/proposicoes-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormProposicao } from "@/components/forms/proposicao";

export const metadata: Metadata = { title: "Nova proposição" };

export default async function NovaProposicaoPage() {
  await exigirPermissaoPagina("dados:criar");
  const eixos = await opcoesProposicao(prisma);
  return (
    <>
      <Link href="/oportunidades/historico" className="text-sm text-slate-600 hover:underline">← Histórico legislativo</Link>
      <CabecalhoPagina titulo="Nova proposição" descricao="Tipo, número e ano não podem se repetir." />
      <Cartao className="max-w-3xl"><FormProposicao acao={criarProposicaoAction} eixos={eixos} /></Cartao>
    </>
  );
}

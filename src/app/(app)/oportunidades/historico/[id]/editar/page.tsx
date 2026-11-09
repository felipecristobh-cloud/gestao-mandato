import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { obterProposicao, opcoesProposicao } from "@/server/services/proposicoes";
import { atualizarProposicaoAction } from "@/server/services/proposicoes-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormProposicao } from "@/components/forms/proposicao";
import { rotuloProposicao } from "@/lib/proposicoes";

export const metadata: Metadata = { title: "Editar proposição" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditarProposicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const p = await obterProposicao(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
  if (!p.podeEditar) redirect(`/oportunidades/historico/${id}`);
  const eixos = await opcoesProposicao(prisma, p.eixoId);
  const t = (v: string | null) => v ?? "";
  const valores = {
    tipo: p.tipo, numero: String(p.numero), ano: String(p.ano), ementa: p.ementa, descricao: t(p.descricao), justificativa: t(p.justificativa),
    participacao: p.participacao, parlamentares: t(p.parlamentares), dataApresentacao: iso(p.dataApresentacao), comissoes: t(p.comissoes),
    pareceres: t(p.pareceres), situacao: t(p.situacao), resultadoVotacao: t(p.resultadoVotacao), lei: t(p.lei), dataConclusao: iso(p.dataConclusao),
    linkOficial: t(p.linkOficial), observacoes: t(p.observacoes), fonte: p.fonte, verificacao: p.verificacao, eixoId: p.eixoId ? String(p.eixoId) : "",
  };
  return (
    <>
      <Link href={`/oportunidades/historico/${id}`} className="text-sm text-slate-600 hover:underline">← {rotuloProposicao(p)}</Link>
      <CabecalhoPagina titulo="Editar proposição" descricao="Se corrigir algo que estava errado, marque a verificação como “Informação corrigida”." />
      <Cartao className="max-w-3xl"><FormProposicao acao={atualizarProposicaoAction.bind(null, id)} eixos={eixos} valores={valores} edicao /></Cartao>
    </>
  );
}

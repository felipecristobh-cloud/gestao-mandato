import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { obterOportunidade, opcoesFormOportunidade } from "@/server/services/oportunidades";
import { atualizarOportunidadeAction } from "@/server/services/oportunidades-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormOportunidade } from "@/components/forms/oportunidade";

export const metadata: Metadata = { title: "Editar oportunidade" };

export default async function EditarOportunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const o = await obterOportunidade(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
  if (!o.podeEditar) redirect(`/oportunidades/${id}`);
  const opcoes = await opcoesFormOportunidade(prisma, o.eixoId);
  const valores = {
    nome: o.nome, problema: o.problema, descricaoProblema: o.descricaoProblema, publico: o.publico, objetivo: o.objetivo, solucao: o.solucao,
    resultados: o.resultados ?? "", fundamentacao: o.fundamentacao ?? "", legislacaoRelacionada: o.legislacaoRelacionada ?? "",
    projetosSemelhantes: o.projetosSemelhantes ?? "", parceiros: o.parceiros ?? "", eixoId: String(o.eixoId), responsavelId: o.responsavelId ?? "",
    bairroIds: o.bairros.map((b) => b.bairroId).join(","), regionalIds: o.regionais.map((r) => r.regionalId).join(","),
  };
  return (
    <>
      <Link href={`/oportunidades/${id}`} className="text-sm text-slate-600 hover:underline">← {o.nome}</Link>
      <CabecalhoPagina titulo="Editar oportunidade" />
      <Cartao className="max-w-3xl"><FormOportunidade acao={atualizarOportunidadeAction.bind(null, id)} opcoes={opcoes} valores={valores} edicao /></Cartao>
    </>
  );
}

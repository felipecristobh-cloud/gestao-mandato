import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesDemanda } from "@/server/services/demandas";
import { atualizarDemandaAction } from "@/server/services/demandas-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormDemanda } from "@/components/forms/demanda";
import { dataISO } from "@/lib/demandas";
import { carregarDemanda } from "../carregar";

export const metadata: Metadata = { title: "Editar demanda" };

export default async function EditarDemandaPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const d = await carregarDemanda(ator, id);
  if (!d.podeEditar) redirect(`/demandas/${d.id}`);
  const opcoes = await opcoesDemanda(prisma);
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const valores = {
    solicitanteNome: d.pessoa.nome, telefone: s(d.pessoa.telefone), email: s(d.pessoa.email),
    endereco: s(d.endereco), bairroId: s(d.bairroId), temaId: s(d.temaId), tipo: d.tipo, descricao: d.descricao,
    prioridade: d.prioridade, prazo: d.prazo ? dataISO(d.prazo) : "", responsavelId: s(d.responsavelId), orgaoId: s(d.orgaoId),
    observacoes: s(d.observacoes),
  };
  return (
    <>
      <Link href={`/demandas/${d.id}`} className="text-sm text-slate-600 hover:underline">← {d.protocolo}</Link>
      <CabecalhoPagina titulo={`Editar ${d.protocolo}`} descricao="Status e encaminhamentos são alterados na página da demanda." />
      <Cartao className="max-w-3xl"><FormDemanda acao={atualizarDemandaAction.bind(null, d.id)} opcoes={opcoes} valores={valores} edicao /></Cartao>
    </>
  );
}

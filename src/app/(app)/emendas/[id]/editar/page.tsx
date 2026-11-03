import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesEmenda } from "@/server/services/emendas";
import { atualizarEmendaAction } from "@/server/services/emendas-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormEmenda } from "@/components/forms/emenda";
import { dataISO } from "@/lib/demandas";
import { formatarCnpj, valorParaCampo } from "@/lib/emendas";
import { carregarEmenda } from "../../carregar";

export const metadata: Metadata = { title: "Editar emenda" };

export default async function EditarEmendaPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const e = await carregarEmenda(ator, id);
  if (!e.podeEditar) redirect(`/emendas/${e.id}`);
  const { orgaos, regionais, responsaveis } = await opcoesEmenda(prisma);
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const valores = {
    numero: s(e.numero), ano: s(e.ano), esfera: e.esfera, tipo: e.tipo, objeto: e.objeto, justificativa: s(e.justificativa),
    valorIndicado: valorParaCampo(e.valores.indicado), valorAprovado: valorParaCampo(e.valores.aprovado),
    beneficiario: s(e.beneficiario), cnpj: formatarCnpj(e.cnpj), orgaoId: s(e.orgaoId), secretaria: s(e.secretaria), municipio: s(e.municipio),
    bairroId: s(e.bairroId), programa: s(e.programa), acaoOrcamentaria: s(e.acaoOrcamentaria), prazo: e.prazo ? dataISO(e.prazo) : "",
    responsavelId: s(e.responsavelId), observacoes: s(e.observacoes),
  };
  return (
    <>
      <Link href={`/emendas/${e.id}`} className="text-sm text-slate-600 hover:underline">← {e.codigo}</Link>
      <CabecalhoPagina titulo={`Editar ${e.codigo}`} descricao="Status, execução, mandatos e documentos são alterados na página da emenda." />
      <Cartao className="max-w-3xl"><FormEmenda acao={atualizarEmendaAction.bind(null, e.id)} opcoes={{ orgaos, regionais, responsaveis }} valores={valores} edicao /></Cartao>
    </>
  );
}

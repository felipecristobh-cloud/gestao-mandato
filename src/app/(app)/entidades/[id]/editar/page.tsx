import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesFormEntidade } from "@/server/services/entidades";
import { atualizarEntidadeAction } from "@/server/services/entidades-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormEntidade } from "@/components/forms/entidade";
import { formatarCnpj } from "@/lib/emendas";
import { carregarEntidade } from "../../carregar";

export const metadata: Metadata = { title: "Editar entidade" };

export default async function EditarEntidadePage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const e = await carregarEntidade(ator, id);
  if (!e.podeEditar) redirect(`/entidades/${e.id}`);
  const opcoes = await opcoesFormEntidade(prisma);
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const valores = {
    nome: e.nome, cnpj: e.cnpj ? formatarCnpj(e.cnpj) : "", tipo: e.tipo, temaId: s(e.temaId), endereco: s(e.endereco), bairroId: s(e.bairroId),
    telefone: s(e.telefone), email: s(e.email), responsavel: s(e.responsavel), observacoes: s(e.observacoes), ativo: e.ativo ? "on" : "",
  };
  return (
    <>
      <Link href={`/entidades/${e.id}`} className="text-sm text-slate-600 hover:underline">← {e.nome}</Link>
      <CabecalhoPagina titulo={`Editar ${e.nome}`} descricao="Vínculos com mandatos são alterados na página da entidade." />
      <Cartao className="max-w-3xl"><FormEntidade acao={atualizarEntidadeAction.bind(null, e.id)} opcoes={opcoes} valores={valores} edicao /></Cartao>
    </>
  );
}

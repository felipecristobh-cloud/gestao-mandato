import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesFormEntidade } from "@/server/services/entidades";
import { criarEntidadeAction } from "@/server/services/entidades-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormEntidade } from "@/components/forms/entidade";

export const metadata: Metadata = { title: "Nova entidade" };

export default async function NovaEntidadePage() {
  await exigirPermissaoPagina("dados:criar");
  const opcoes = await opcoesFormEntidade(prisma);
  return (
    <>
      <Link href="/entidades" className="text-sm text-slate-600 hover:underline">← Entidades</Link>
      <CabecalhoPagina titulo="Nova entidade" descricao="O sistema avisa se já houver entidade com nome parecido ou o mesmo CNPJ." />
      <Cartao className="max-w-3xl"><FormEntidade acao={criarEntidadeAction} opcoes={opcoes} valores={{ tipo: "ASSOCIACAO" }} /></Cartao>
    </>
  );
}

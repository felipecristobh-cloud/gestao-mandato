import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesFormOportunidade } from "@/server/services/oportunidades";
import { criarOportunidadeAction } from "@/server/services/oportunidades-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormOportunidade } from "@/components/forms/oportunidade";

export const metadata: Metadata = { title: "Nova oportunidade" };

export default async function NovaOportunidadePage() {
  const ator = await exigirPermissaoPagina("dados:criar");
  const opcoes = await opcoesFormOportunidade(prisma);
  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina titulo="Nova oportunidade" descricao="Cadastre a ideia. A avaliação e a prioridade ficam na página da proposta." />
      <Cartao className="max-w-3xl"><FormOportunidade acao={criarOportunidadeAction} opcoes={opcoes} valores={{ responsavelId: ator.id }} /></Cartao>
    </>
  );
}

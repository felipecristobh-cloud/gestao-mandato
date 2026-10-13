import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesDemanda } from "@/server/services/demandas";
import { criarDemandaAction } from "@/server/services/demandas-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormDemanda } from "@/components/forms/demanda";

export const metadata: Metadata = { title: "Nova demanda" };

export default async function NovaDemandaPage({ searchParams }: { searchParams: Promise<{ entidade?: string }> }) {
  await exigirPermissaoPagina("dados:criar");
  const { entidade } = await searchParams;
  const opcoes = await opcoesDemanda(prisma);
  const entidadeId = opcoes.entidades.some((e) => e.id === entidade) ? entidade : undefined;
  return (
    <>
      <Link href="/demandas" className="text-sm text-slate-600 hover:underline">← Demandas</Link>
      <CabecalhoPagina titulo="Nova demanda" descricao="Antes de salvar, o sistema procura demandas e solicitantes parecidos." />
      <Cartao className="max-w-3xl"><FormDemanda acao={criarDemandaAction} opcoes={opcoes} valores={entidadeId ? { entidadeId } : undefined} /></Cartao>
    </>
  );
}

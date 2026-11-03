import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesEmenda } from "@/server/services/emendas";
import { criarEmendaAction } from "@/server/services/emendas-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormEmenda } from "@/components/forms/emenda";
import { hojeISO } from "@/lib/demandas";

export const metadata: Metadata = { title: "Nova emenda" };

export default async function NovaEmendaPage({ searchParams }: { searchParams: Promise<{ entidade?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:criar");
  const { entidade } = await searchParams;
  const { orgaos, regionais, responsaveis, entidades } = await opcoesEmenda(prisma);
  const entidadeId = entidades.some((e) => e.id === entidade) ? entidade! : "";
  return (
    <>
      <Link href="/emendas" className="text-sm text-slate-600 hover:underline">← Emendas</Link>
      <CabecalhoPagina titulo="Nova emenda" descricao="O código interno (EME-AAAA-NNNNN) é gerado ao salvar." />
      <Cartao className="max-w-3xl">
        <FormEmenda acao={criarEmendaAction} opcoes={{ orgaos, regionais, responsaveis, entidades }} valores={{ ano: hojeISO().slice(0, 4), entidadeId, responsavelId: ator.perfil === "ASSESSOR" ? ator.id : "" }} />
      </Cartao>
    </>
  );
}

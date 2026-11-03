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

export default async function NovaEmendaPage() {
  const ator = await exigirPermissaoPagina("dados:criar");
  const { orgaos, regionais, responsaveis } = await opcoesEmenda(prisma);
  return (
    <>
      <Link href="/emendas" className="text-sm text-slate-600 hover:underline">← Emendas</Link>
      <CabecalhoPagina titulo="Nova emenda" descricao="O código interno (EME-AAAA-NNNNN) é gerado ao salvar." />
      <Cartao className="max-w-3xl">
        <FormEmenda acao={criarEmendaAction} opcoes={{ orgaos, regionais, responsaveis }} valores={{ ano: hojeISO().slice(0, 4), responsavelId: ator.perfil === "ASSESSOR" ? ator.id : "" }} />
      </Cartao>
    </>
  );
}

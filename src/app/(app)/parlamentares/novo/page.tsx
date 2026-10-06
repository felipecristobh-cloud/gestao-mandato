import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { criarParlamentarAction } from "@/server/services/parlamentares-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormParlamentar } from "@/components/forms/parlamentar";

export const metadata: Metadata = { title: "Novo parlamentar" };

export default async function NovoParlamentarPage() {
  const ator = await exigirPermissaoPagina("dados:criar");
  return (
    <>
      <Link href="/parlamentares" className="text-sm text-slate-600 hover:underline">← Parlamentares</Link>
      <CabecalhoPagina titulo="Novo parlamentar" descricao="Depois de salvar, cadastre os mandatos na página do parlamentar." />
      <Cartao className="max-w-3xl"><FormParlamentar acao={criarParlamentarAction} podeDefinirProprio={pode(ator, "cadastros_base:gerenciar")} /></Cartao>
    </>
  );
}

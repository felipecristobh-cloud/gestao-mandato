import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { atualizarParlamentarAction } from "@/server/services/parlamentares-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormParlamentar } from "@/components/forms/parlamentar";
import { carregarParlamentar } from "../../carregar";

export const metadata: Metadata = { title: "Editar parlamentar" };

export default async function EditarParlamentarPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const p = await carregarParlamentar(ator, id);
  if (!p.podeEditar) redirect(`/parlamentares/${p.id}`);
  const s = (v: string | null) => v ?? "";
  const valores = {
    nome: p.nome, cargo: p.cargo, esfera: p.cargo === "OUTRO" ? p.esfera : "", partido: s(p.partido), municipio: s(p.municipio), uf: s(p.uf),
    telefone: s(p.telefone), email: s(p.email), observacoes: s(p.observacoes), ativo: p.ativo ? "on" : "", proprio: p.proprio ? "on" : "",
  };
  return (
    <>
      <Link href={`/parlamentares/${p.id}`} className="text-sm text-slate-600 hover:underline">← {p.nome}</Link>
      <CabecalhoPagina titulo={`Editar ${p.nome}`} descricao="Mandatos são editados na página do parlamentar." />
      <Cartao className="max-w-3xl">
        <FormParlamentar acao={atualizarParlamentarAction.bind(null, p.id)} valores={valores} edicao podeDefinirProprio={pode(ator, "cadastros_base:gerenciar")} />
      </Cartao>
    </>
  );
}

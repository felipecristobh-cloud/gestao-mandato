import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { criarUsuarioAction } from "@/server/services/usuarios-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormUsuario } from "@/components/forms/usuario";

export const metadata: Metadata = { title: "Novo usuário" };

export default async function NovoUsuarioPage() {
  await exigirPermissaoPagina("usuarios:gerenciar");
  return (
    <>
      <Link href="/usuarios" className="text-sm text-slate-600 hover:underline">← Usuários</Link>
      <CabecalhoPagina titulo="Novo usuário" descricao="O sistema gera uma senha temporária, que deve ser trocada no primeiro acesso." />
      <Cartao className="max-w-2xl"><FormUsuario acao={criarUsuarioAction} /></Cartao>
    </>
  );
}

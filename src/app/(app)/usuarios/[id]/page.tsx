import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { obterUsuario } from "@/server/services/usuarios";
import { atualizarUsuarioAction, redefinirSenhaAction } from "@/server/services/usuarios-actions";
import { AppError } from "@/server/errors";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { BotaoRedefinirSenha, FormUsuario } from "@/components/forms/usuario";

export const metadata: Metadata = { title: "Editar usuário" };

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("usuarios:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const u = await obterUsuario(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
  return (
    <>
      <Link href="/usuarios" className="text-sm text-slate-600 hover:underline">← Usuários</Link>
      <CabecalhoPagina titulo={u.nome} descricao={u.email} />
      <div className="grid max-w-2xl gap-6">
        <Cartao><FormUsuario acao={atualizarUsuarioAction.bind(null, u.id)} valores={u} edicao /></Cartao>
        <Cartao>
          <h2 className="mb-1 text-base font-semibold">Senha</h2>
          <p className="mb-3 text-sm text-slate-600">Use se o usuário esqueceu a senha ou foi bloqueado. Ele terá de criar uma nova no próximo acesso.</p>
          <BotaoRedefinirSenha acao={redefinirSenhaAction.bind(null, u.id)} />
        </Cartao>
      </div>
    </>
  );
}

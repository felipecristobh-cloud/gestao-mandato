import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { COOKIE_SESSAO, validarSessao, type UsuarioSessao } from "./session";
import { pode, type Permissao } from "@/server/authz";

export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return validarSessao(prisma, token);
});

/** Para páginas e ações: exige login (e senha já trocada). */
export async function exigirUsuario(opcoes: { permitirTrocaPendente?: boolean } = {}) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  if (u.trocarSenha && !opcoes.permitirTrocaPendente) redirect("/trocar-senha");
  return u;
}

export async function exigirPermissaoPagina(permissao: Permissao) {
  const u = await exigirUsuario();
  if (!pode(u, permissao)) redirect("/sem-permissao");
  return u;
}

export async function metaRequisicao() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") || undefined,
  };
}

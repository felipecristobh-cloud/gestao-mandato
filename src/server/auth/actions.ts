"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { autenticar } from "./login";
import { COOKIE_SESSAO, encerrarSessao, hashToken } from "./session";
import { exigirUsuario, metaRequisicao } from "./current";
import { registrarAuditoria } from "@/server/audit";
import { trocarPropriaSenha } from "@/server/services/usuarios";
import { AppError } from "@/server/errors";

export type EstadoForm = { erro?: string; ok?: string } | undefined;

export async function entrarAction(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };
  const r = await autenticar(prisma, email, senha, await metaRequisicao());
  if (!r.ok) {
    return {
      erro: r.motivo === "BLOQUEADO"
        ? "Muitas tentativas. Acesso bloqueado por 15 minutos."
        : "E-mail ou senha incorretos.",
    };
  }
  (await cookies()).set(COOKIE_SESSAO, r.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: r.expiraEm,
  });
  redirect(r.trocarSenha ? "/trocar-senha" : "/dashboard");
}

export async function sairAction() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) {
    const sessao = await prisma.sessao.findUnique({ where: { id: hashToken(token) } });
    await encerrarSessao(prisma, token);
    if (sessao) await registrarAuditoria(prisma, { usuarioId: sessao.usuarioId, entidade: "usuario", registroId: sessao.usuarioId, acao: "LOGOUT" });
  }
  jar.delete(COOKIE_SESSAO);
  redirect("/login");
}

export async function trocarSenhaAction(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario({ permitirTrocaPendente: true });
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  if (nova !== String(form.get("confirmacao") ?? "")) return { erro: "A confirmação não confere com a nova senha." };
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  try {
    await trocarPropriaSenha(prisma, u, atual, nova, token ? hashToken(token) : undefined);
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message };
    throw e;
  }
  redirect("/dashboard?senha=ok");
}

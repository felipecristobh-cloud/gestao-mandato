"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { atualizarUsuario, criarUsuario, redefinirSenha } from "./usuarios";

export type EstadoUsuario = { erro?: string; ok?: string; senhaTemporaria?: string; email?: string } | undefined;

function dadosDoForm(form: FormData) {
  return {
    nome: String(form.get("nome") ?? ""),
    email: String(form.get("email") ?? ""),
    telefone: String(form.get("telefone") ?? ""),
    cargo: String(form.get("cargo") ?? ""),
    perfil: String(form.get("perfil") ?? "") as "ADMIN",
  };
}

async function tratar<T>(fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message };
    throw e;
  }
}

export async function criarUsuarioAction(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const ator = await exigirUsuario();
  const r = await tratar(() => criarUsuario(prisma, ator, dadosDoForm(form)));
  if ("erro" in r) return r;
  revalidatePath("/usuarios");
  return { ok: "Usuário criado.", senhaTemporaria: r.senhaTemporaria, email: r.usuario.email };
}

export async function atualizarUsuarioAction(id: string, _: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const ator = await exigirUsuario();
  const r = await tratar(() => atualizarUsuario(prisma, ator, id, { ...dadosDoForm(form), ativo: form.get("ativo") === "on" }));
  if (r && typeof r === "object" && "erro" in r) return r as { erro: string };
  revalidatePath("/usuarios");
  return { ok: "Alterações salvas." };
}

export async function redefinirSenhaAction(id: string, _estado: EstadoUsuario): Promise<EstadoUsuario> {
  const ator = await exigirUsuario();
  const r = await tratar(() => redefinirSenha(prisma, ator, id));
  if ("erro" in r) return r;
  return { ok: "Senha redefinida. Todas as sessões do usuário foram encerradas.", senhaTemporaria: r.senhaTemporaria };
}

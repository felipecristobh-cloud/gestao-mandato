"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  atualizarEntidade, buscarEntidadesSemelhantes, criarEntidade, desvincularMandatoEntidade, vincularMandatoEntidade, type EntidadeSemelhante,
} from "./entidades";
import type { EntidadeEntrada } from "@/lib/validacao/entidade";
import type { Valores } from "./parlamentares-actions";

export type EstadoEntidade = { erro?: string; ok?: string; valores?: Valores; semelhantes?: EntidadeSemelhante[]; n?: number } | undefined;

const CAMPOS = ["nome", "cnpj", "tipo", "temaId", "endereco", "bairroId", "telefone", "email", "responsavel", "observacoes", "ativo"];
const CAMPOS_VINCULO = ["mandatoId", "tipo", "observacoes"];

const valoresDoForm = (form: FormData, campos: string[]): Valores => Object.fromEntries(campos.map((c) => [c, String(form.get(c) ?? "")]));

async function tratar(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof AppError) return e.message;
    throw e;
  }
}

export async function criarEntidadeAction(estado: EstadoEntidade, form: FormData): Promise<EstadoEntidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS);
  const n = (estado?.n ?? 0) + 1;
  if (form.get("confirmar") !== "1") {
    const semelhantes = await buscarEntidadesSemelhantes(prisma, ator, valores).catch(() => []);
    if (semelhantes.length) return { semelhantes, valores, n };
  }
  let id = "";
  const erro = await tratar(async () => { id = (await criarEntidade(prisma, ator, valores as unknown as EntidadeEntrada)).id; });
  if (erro) return { erro, valores, semelhantes: estado?.semelhantes, n };
  revalidatePath("/entidades");
  redirect(`/entidades/${id}?criada=1`);
}

export async function atualizarEntidadeAction(id: string, estado: EstadoEntidade, form: FormData): Promise<EstadoEntidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS);
  const erro = await tratar(() => atualizarEntidade(prisma, ator, id, valores as unknown as EntidadeEntrada));
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/entidades");
  revalidatePath(`/entidades/${id}`);
  redirect(`/entidades/${id}`);
}

async function simples(id: string, ok: string, campos: string[], estado: EstadoEntidade, form: FormData, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, v: Valores) => Promise<unknown>): Promise<EstadoEntidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, campos);
  const erro = await tratar(() => fn(ator, valores));
  const n = (estado?.n ?? 0) + 1;
  if (erro) return { erro, valores, n };
  revalidatePath(`/entidades/${id}`);
  revalidatePath("/entidades");
  return { ok, n };
}

export async function vincularMandatoEntidadeAction(entidadeId: string, e: EstadoEntidade, f: FormData) {
  return simples(entidadeId, "Mandato vinculado.", CAMPOS_VINCULO, e, f, (a, v) => vincularMandatoEntidade(prisma, a, entidadeId, v));
}

export async function desvincularMandatoEntidadeAction(entidadeId: string, vinculoId: string, e: EstadoEntidade, f: FormData) {
  return simples(entidadeId, "Vínculo removido.", [], e, f, (a) => desvincularMandatoEntidade(prisma, a, vinculoId));
}

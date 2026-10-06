"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  atualizarMandato, atualizarParlamentar, criarMandato, criarParlamentar, desvincularMandato, excluirMandato, vincularMandato,
} from "./parlamentares";
import type { MandatoEntrada, ParlamentarEntrada } from "@/lib/validacao/parlamentar";

export type Valores = Record<string, string>;
export type EstadoForm = { erro?: string; ok?: string; valores?: Valores; n?: number } | undefined;

const CAMPOS_PARLAMENTAR = ["nome", "cargo", "esfera", "partido", "municipio", "uf", "telefone", "email", "observacoes", "ativo", "proprio"];
const CAMPOS_MANDATO = ["cargo", "esfera", "legislatura", "descricao", "partido", "municipio", "uf", "dataInicio", "dataFim", "observacoes"];
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

export async function criarParlamentarAction(estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS_PARLAMENTAR);
  let id = "";
  const erro = await tratar(async () => { id = (await criarParlamentar(prisma, ator, valores as unknown as ParlamentarEntrada)).id; });
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/parlamentares");
  redirect(`/parlamentares/${id}?criado=1`);
}

export async function atualizarParlamentarAction(id: string, estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS_PARLAMENTAR);
  const erro = await tratar(() => atualizarParlamentar(prisma, ator, id, valores as unknown as ParlamentarEntrada));
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/parlamentares");
  revalidatePath(`/parlamentares/${id}`);
  redirect(`/parlamentares/${id}`);
}

async function simples(caminhos: string[], ok: string, campos: string[], estado: EstadoForm, form: FormData, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, v: Valores) => Promise<unknown>): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, campos);
  const erro = await tratar(() => fn(ator, valores));
  const n = (estado?.n ?? 0) + 1;
  if (erro) return { erro, valores, n };
  for (const c of caminhos) revalidatePath(c);
  return { ok, n };
}

export async function criarMandatoAction(parlamentarId: string, e: EstadoForm, f: FormData) {
  return simples([`/parlamentares/${parlamentarId}`, "/parlamentares"], "Mandato cadastrado.", CAMPOS_MANDATO, e, f, (a, v) => criarMandato(prisma, a, parlamentarId, v as unknown as MandatoEntrada));
}

export async function atualizarMandatoAction(parlamentarId: string, mandatoId: string, e: EstadoForm, f: FormData) {
  return simples([`/parlamentares/${parlamentarId}`, "/parlamentares"], "Mandato atualizado.", CAMPOS_MANDATO, e, f, (a, v) => atualizarMandato(prisma, a, mandatoId, v as unknown as MandatoEntrada));
}

export async function excluirMandatoAction(parlamentarId: string, mandatoId: string, e: EstadoForm, f: FormData) {
  return simples([`/parlamentares/${parlamentarId}`, "/parlamentares"], "Mandato excluído.", [], e, f, (a) => excluirMandato(prisma, a, mandatoId));
}

export async function vincularMandatoAction(demandaId: string, e: EstadoForm, f: FormData) {
  return simples([`/demandas/${demandaId}`, "/parlamentares"], "Mandato vinculado.", CAMPOS_VINCULO, e, f, (a, v) => vincularMandato(prisma, a, demandaId, v));
}

export async function desvincularMandatoAction(demandaId: string, vinculoId: string, e: EstadoForm, f: FormData) {
  return simples([`/demandas/${demandaId}`, "/parlamentares"], "Vínculo removido.", [], e, f, (a) => desvincularMandato(prisma, a, vinculoId));
}

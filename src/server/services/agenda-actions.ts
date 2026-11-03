"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  alterarStatusCompromisso, atualizarCompromisso, buscarChoques, comentarCompromisso, criarCompromisso, desvincularCompromisso,
  normalizarCompromisso, registrarResultado, vincularCompromisso, type Choque,
} from "./agenda";
import type { CompromissoEntrada } from "@/lib/validacao/agenda";
import type { Valores } from "./parlamentares-actions";

export type EstadoAgenda = { erro?: string; ok?: string; valores?: Valores; choques?: Choque[]; n?: number } | undefined;

const CAMPOS = ["titulo", "tipo", "inicio", "fim", "local", "bairroId", "pauta", "agendaVereador", "responsavelId", "confirmado", "vinculo"];

function lerForm(form: FormData) {
  const valores: Valores = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const participantes = form.getAll("participantes").map(String).filter(Boolean);
  valores.participantes = participantes.join(",");
  return { valores, entrada: { ...valores, participantes } as unknown as CompromissoEntrada & { confirmado?: string; vinculo?: string } };
}

async function tratar(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof AppError) return e.message;
    throw e;
  }
}

async function choquesDe(ator: Awaited<ReturnType<typeof exigirUsuario>>, entrada: CompromissoEntrada, ignorarId?: string) {
  try {
    const { dados, participantes } = normalizarCompromisso(entrada);
    return await buscarChoques(prisma, ator, { ...dados, participantes }, ignorarId);
  } catch {
    return [];
  }
}

export async function criarCompromissoAction(estado: EstadoAgenda, form: FormData): Promise<EstadoAgenda> {
  const ator = await exigirUsuario();
  const { valores, entrada } = lerForm(form);
  const n = (estado?.n ?? 0) + 1;
  if (form.get("confirmar") !== "1") {
    const choques = await choquesDe(ator, entrada);
    if (choques.length) return { choques, valores, n };
  }
  let id = "";
  const erro = await tratar(async () => { id = (await criarCompromisso(prisma, ator, entrada)).id; });
  if (erro) return { erro, valores, choques: estado?.choques, n };
  revalidatePath("/agenda");
  redirect(`/agenda/${id}?criado=1`);
}

export async function atualizarCompromissoAction(id: string, estado: EstadoAgenda, form: FormData): Promise<EstadoAgenda> {
  const ator = await exigirUsuario();
  const { valores, entrada } = lerForm(form);
  const n = (estado?.n ?? 0) + 1;
  if (form.get("confirmar") !== "1") {
    const choques = await choquesDe(ator, entrada, id);
    if (choques.length) return { choques, valores, n };
  }
  const erro = await tratar(() => atualizarCompromisso(prisma, ator, id, entrada));
  if (erro) return { erro, valores, choques: estado?.choques, n };
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

function acao(campos: string[], ok: string, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, alvo: string, v: Valores) => Promise<unknown>) {
  return async (compromissoId: string, alvo: string, estado: EstadoAgenda, form: FormData): Promise<EstadoAgenda> => {
    const ator = await exigirUsuario();
    const valores: Valores = Object.fromEntries(campos.map((c) => [c, String(form.get(c) ?? "")]));
    const erro = await tratar(() => fn(ator, alvo, valores));
    const n = (estado?.n ?? 0) + 1;
    if (erro) return { erro, valores, n };
    revalidatePath(`/agenda/${compromissoId}`);
    revalidatePath("/agenda");
    return { ok, n };
  };
}

const _status = acao(["status", "motivo"], "Status atualizado.", (a, id, v) => alterarStatusCompromisso(prisma, a, id, { status: v.status, motivo: v.motivo }));
const _resultado = acao(["resultado", "encaminhamentos"], "Resultado registrado.", (a, id, v) => registrarResultado(prisma, a, id, v));
const _comentar = acao(["texto"], "Comentário registrado.", (a, id, v) => comentarCompromisso(prisma, a, id, v.texto));
const _vincular = acao(["alvo"], "Vínculo registrado.", (a, id, v) => vincularCompromisso(prisma, a, id, v.alvo));
const _desvincular = acao([], "Vínculo removido.", (a, vinculoId) => desvincularCompromisso(prisma, a, vinculoId));

export async function statusCompromissoAction(id: string, e: EstadoAgenda, f: FormData) { return _status(id, id, e, f); }
export async function resultadoCompromissoAction(id: string, e: EstadoAgenda, f: FormData) { return _resultado(id, id, e, f); }
export async function comentarCompromissoAction(id: string, e: EstadoAgenda, f: FormData) { return _comentar(id, id, e, f); }
export async function vincularCompromissoAction(id: string, e: EstadoAgenda, f: FormData) { return _vincular(id, id, e, f); }
export async function desvincularCompromissoAction(id: string, vinculoId: string, e: EstadoAgenda, f: FormData) { return _desvincular(id, vinculoId, e, f); }

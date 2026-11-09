"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario, metaRequisicao } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  alterarEtapa, alternarEixo, atualizarOportunidade, avaliarOportunidade, criarEixo, criarOportunidade, definirPrioridadeManual, desvincularOportunidade,
  salvarTexto, vincularOportunidade,
} from "./oportunidades";
import type { AvaliacaoEntrada, OportunidadeEntrada } from "@/lib/validacao/oportunidade";
import type { Valores } from "./parlamentares-actions";

export type EstadoOportunidade = { erro?: string; ok?: string; valores?: Valores; n?: number } | undefined;

const CAMPOS = [
  "nome", "problema", "descricaoProblema", "publico", "objetivo", "solucao", "resultados", "fundamentacao", "legislacaoRelacionada",
  "projetosSemelhantes", "parceiros", "eixoId", "responsavelId",
];
const LISTAS = ["bairroIds", "regionalIds"];
const NOTAS = ["notaImpacto", "notaAlcance", "notaViabilidade", "notaExecucao", "notaInovacao"];

const valoresDoForm = (form: FormData, campos: string[], listas: string[] = []): Valores => ({
  ...Object.fromEntries(campos.map((c) => [c, String(form.get(c) ?? "")])),
  ...Object.fromEntries(listas.map((c) => [c, form.getAll(c).map(String).join(",")])),
});

async function tratar(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof AppError) return e.message;
    throw e;
  }
}

export async function criarOportunidadeAction(estado: EstadoOportunidade, form: FormData): Promise<EstadoOportunidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS, LISTAS);
  let id = "";
  const origem = { demandaId: String(form.get("origemDemanda") ?? "") || null, compromissoId: String(form.get("origemCompromisso") ?? "") || null };
  const erro = await tratar(async () => {
    id = (await criarOportunidade(prisma, ator, valores as unknown as OportunidadeEntrada, await metaRequisicao(), origem)).id;
  });
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/oportunidades");
  redirect(`/oportunidades/${id}?criada=1`);
}

export async function atualizarOportunidadeAction(id: string, estado: EstadoOportunidade, form: FormData): Promise<EstadoOportunidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS, LISTAS);
  const erro = await tratar(() => atualizarOportunidade(prisma, ator, id, valores as unknown as OportunidadeEntrada));
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/oportunidades");
  revalidatePath(`/oportunidades/${id}`);
  redirect(`/oportunidades/${id}`);
}

async function simples(caminho: string, ok: string, campos: string[], estado: EstadoOportunidade, form: FormData, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, v: Valores) => Promise<unknown>): Promise<EstadoOportunidade> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, campos);
  const erro = await tratar(() => fn(ator, valores));
  const n = (estado?.n ?? 0) + 1;
  if (erro) return { erro, valores, n };
  revalidatePath(caminho);
  revalidatePath("/oportunidades");
  return { ok, n };
}

export async function avaliarOportunidadeAction(id: string, e: EstadoOportunidade, f: FormData) {
  return simples(`/oportunidades/${id}`, "Avaliação salva.", NOTAS, e, f, (a, v) => avaliarOportunidade(prisma, a, id, v as unknown as AvaliacaoEntrada));
}

export async function definirPrioridadeAction(id: string, e: EstadoOportunidade, f: FormData) {
  return simples(`/oportunidades/${id}`, "Prioridade atualizada.", ["prioridade", "justificativa"], e, f, (a, v) => definirPrioridadeManual(prisma, a, id, v));
}

export async function criarEixoAction(e: EstadoOportunidade, f: FormData) {
  return simples("/oportunidades/eixos", "Eixo criado.", ["nome"], e, f, (a, v) => criarEixo(prisma, a, v));
}

export async function alternarEixoAction(id: number, e: EstadoOportunidade, f: FormData) {
  return simples("/oportunidades/eixos", "Eixo atualizado.", [], e, f, (a) => alternarEixo(prisma, a, id));
}

export async function etapaOportunidadeAction(id: string, e: EstadoOportunidade, f: FormData) {
  return simples(`/oportunidades/${id}`, "Etapa atualizada.", ["etapa", "observacao"], e, f, async (a, v) => alterarEtapa(prisma, a, id, v, await metaRequisicao()));
}

export async function textoOportunidadeAction(id: string, tipo: string, e: EstadoOportunidade, f: FormData) {
  return simples(`/oportunidades/${id}`, "Nova versão salva.", ["conteudo"], e, f, async (a, v) => salvarTexto(prisma, a, id, { tipo, conteudo: v.conteudo }, await metaRequisicao()));
}

export async function vincularOportunidadeAction(id: string, e: EstadoOportunidade, f: FormData) {
  const r = await simples(`/oportunidades/${id}`, "Vínculo criado.", ["tipo", "ref"], e, f, async (a, v) => vincularOportunidade(prisma, a, id, v, await metaRequisicao()));
  if (r?.ok) { revalidatePath("/demandas", "layout"); revalidatePath("/emendas", "layout"); revalidatePath("/agenda", "layout"); }
  return r;
}

export async function desvincularOportunidadeAction(id: string, vinculoId: string, e: EstadoOportunidade, f: FormData) {
  return simples(`/oportunidades/${id}`, "Vínculo removido.", [], e, f, async (a) => desvincularOportunidade(prisma, a, id, vinculoId, await metaRequisicao()));
}

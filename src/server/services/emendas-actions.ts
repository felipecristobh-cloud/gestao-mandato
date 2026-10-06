"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  adicionarDocumento, alterarStatusEmenda, atualizarEmenda, comentarEmenda, criarEmenda, desvincularMandatoEmenda,
  excluirLancamento, registrarLancamento, removerDocumento, vincularMandatoEmenda,
} from "./emendas";
import type { EmendaEntrada } from "@/lib/validacao/emenda";
import type { EstadoForm, Valores } from "./parlamentares-actions";

const CAMPOS_EMENDA = [
  "numero", "ano", "esfera", "tipo", "objeto", "justificativa", "valorIndicado", "valorAprovado", "beneficiario", "cnpj", "orgaoId",
  "secretaria", "municipio", "bairroId", "programa", "acaoOrcamentaria", "prazo", "responsavelId", "observacoes",
];
const CAMPOS_LANCAMENTO = ["tipo", "valor", "data", "documento", "observacoes"];
const CAMPOS_VINCULO = ["mandatoId", "tipo", "responsabilidade", "dataInicio", "dataFim", "observacoes"];
const CAMPOS_DOCUMENTO = ["tipo", "descricao", "numero", "data", "url"];

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

export async function criarEmendaAction(estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS_EMENDA);
  let id = "";
  const erro = await tratar(async () => { id = (await criarEmenda(prisma, ator, valores as unknown as EmendaEntrada)).id; });
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/emendas");
  redirect(`/emendas/${id}?criada=1`);
}

export async function atualizarEmendaAction(id: string, estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, CAMPOS_EMENDA);
  const erro = await tratar(() => atualizarEmenda(prisma, ator, id, valores as unknown as EmendaEntrada));
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/emendas");
  revalidatePath(`/emendas/${id}`);
  redirect(`/emendas/${id}`);
}

async function simples(id: string, ok: string, campos: string[], estado: EstadoForm, form: FormData, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, v: Valores) => Promise<unknown>): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form, campos);
  const erro = await tratar(() => fn(ator, valores));
  const n = (estado?.n ?? 0) + 1;
  if (erro) return { erro, valores, n };
  for (const c of [`/emendas/${id}`, "/emendas", "/emendas/rede", "/parlamentares"]) revalidatePath(c);
  return { ok, n };
}

export async function statusEmendaAction(id: string, e: EstadoForm, f: FormData) {
  return simples(id, "Status alterado.", ["status", "comentario"], e, f, (a, v) => alterarStatusEmenda(prisma, a, id, { status: v.status, comentario: v.comentario }));
}

export async function comentarEmendaAction(id: string, e: EstadoForm, f: FormData) {
  return simples(id, "Comentário registrado.", ["texto"], e, f, (a, v) => comentarEmenda(prisma, a, id, v.texto));
}

export async function lancamentoAction(id: string, e: EstadoForm, f: FormData) {
  return simples(id, "Lançamento registrado.", CAMPOS_LANCAMENTO, e, f, (a, v) => registrarLancamento(prisma, a, id, v));
}

export async function excluirLancamentoAction(id: string, lancamentoId: string, e: EstadoForm, f: FormData) {
  return simples(id, "Lançamento excluído.", [], e, f, (a) => excluirLancamento(prisma, a, lancamentoId));
}

export async function vincularMandatoEmendaAction(id: string, e: EstadoForm, f: FormData) {
  return simples(id, "Mandato vinculado.", CAMPOS_VINCULO, e, f, (a, v) => vincularMandatoEmenda(prisma, a, id, v));
}

export async function desvincularMandatoEmendaAction(id: string, vinculoId: string, e: EstadoForm, f: FormData) {
  return simples(id, "Vínculo removido.", [], e, f, (a) => desvincularMandatoEmenda(prisma, a, vinculoId));
}

export async function documentoAction(id: string, e: EstadoForm, f: FormData) {
  return simples(id, "Documento registrado.", CAMPOS_DOCUMENTO, e, f, (a, v) => adicionarDocumento(prisma, a, id, v));
}

export async function removerDocumentoAction(id: string, documentoId: string, e: EstadoForm, f: FormData) {
  return simples(id, "Documento removido.", [], e, f, (a) => removerDocumento(prisma, a, documentoId));
}

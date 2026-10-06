"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import {
  alterarStatus, atualizarDemanda, buscarSemelhantes, comentarDemanda, criarDemanda, encaminharDemanda, registrarRetorno,
  type Semelhantes,
} from "./demandas";
import type { DemandaAtualizar, DemandaCriar } from "@/lib/validacao/demanda";

export type Valores = Record<string, string>;
export type EstadoDemanda = { erro?: string; ok?: string; valores?: Valores; semelhantes?: Semelhantes; n?: number } | undefined;

const CAMPOS = [
  "pessoaId", "solicitanteNome", "telefone", "email", "endereco", "bairroId", "temaId", "tipo", "descricao",
  "prioridade", "status", "prazo", "responsavelId", "orgaoId", "observacoes",
];

function valoresDoForm(form: FormData, campos: string[] = CAMPOS): Valores {
  return Object.fromEntries(campos.map((c) => [c, String(form.get(c) ?? "")]));
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

export async function criarDemandaAction(estado: EstadoDemanda, form: FormData): Promise<EstadoDemanda> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form);
  const n = (estado?.n ?? 0) + 1;

  if (form.get("confirmar") !== "1" && !valores.pessoaId) {
    const semelhantes = await buscarSemelhantes(prisma, ator, valores);
    if (semelhantes.pessoas.length || semelhantes.demandas.length) return { semelhantes, valores, n };
  }

  let id = "";
  const erro = await tratar(async () => {
    id = (await criarDemanda(prisma, ator, valores as unknown as DemandaCriar)).id;
  });
  if (erro) return { erro, valores, semelhantes: estado?.semelhantes, n };
  revalidatePath("/demandas");
  redirect(`/demandas/${id}?criada=1`);
}

export async function atualizarDemandaAction(id: string, estado: EstadoDemanda, form: FormData): Promise<EstadoDemanda> {
  const ator = await exigirUsuario();
  const valores = valoresDoForm(form);
  const erro = await tratar(() => atualizarDemanda(prisma, ator, id, valores as unknown as DemandaAtualizar));
  if (erro) return { erro, valores, n: (estado?.n ?? 0) + 1 };
  revalidatePath("/demandas");
  revalidatePath(`/demandas/${id}`);
  redirect(`/demandas/${id}`);
}

function acaoSimples(campos: string[], ok: string, fn: (ator: Awaited<ReturnType<typeof exigirUsuario>>, alvo: string, v: Valores) => Promise<unknown>) {
  return async (demandaId: string, alvo: string, estado: EstadoDemanda, form: FormData): Promise<EstadoDemanda> => {
    const ator = await exigirUsuario();
    const valores = valoresDoForm(form, campos);
    const erro = await tratar(() => fn(ator, alvo, valores));
    const n = (estado?.n ?? 0) + 1;
    if (erro) return { erro, valores, n };
    revalidatePath(`/demandas/${demandaId}`);
    revalidatePath("/demandas");
    return { ok, n };
  };
}

const _status = acaoSimples(["status", "comentario"], "Status atualizado.", (a, id, v) => alterarStatus(prisma, a, id, { status: v.status, comentario: v.comentario }));
const _comentar = acaoSimples(["texto"], "Comentário registrado.", (a, id, v) => comentarDemanda(prisma, a, id, v.texto));
const _encaminhar = acaoSimples(["orgaoId", "protocolo", "descricao", "prazoRetorno"], "Encaminhamento registrado.", (a, id, v) => encaminharDemanda(prisma, a, id, v));
const _retorno = acaoSimples(["retorno", "dataRetorno"], "Retorno registrado.", (a, id, v) => registrarRetorno(prisma, a, id, v));

export async function alterarStatusAction(id: string, e: EstadoDemanda, f: FormData) { return _status(id, id, e, f); }
export async function comentarAction(id: string, e: EstadoDemanda, f: FormData) { return _comentar(id, id, e, f); }
export async function encaminharAction(id: string, e: EstadoDemanda, f: FormData) { return _encaminhar(id, id, e, f); }
export async function registrarRetornoAction(demandaId: string, encaminhamentoId: string, e: EstadoDemanda, f: FormData) {
  return _retorno(demandaId, encaminhamentoId, e, f);
}

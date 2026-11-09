"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirUsuario, metaRequisicao } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { CAMPOS_PLANILHA, lerPlanilha, type Linha } from "@/server/proposicoes/planilha";
import { atualizarProposicao, conferirImportacao, criarProposicao, importarProposicoes, resumoConferencia, type LinhaConferida } from "./proposicoes";
import type { ProposicaoEntrada } from "@/lib/validacao/proposicao";
import type { Valores } from "./parlamentares-actions";

export type EstadoProposicao = { erro?: string; valores?: Valores; n?: number } | undefined;

const CAMPOS = [
  "tipo", "numero", "ano", "ementa", "descricao", "justificativa", "participacao", "parlamentares", "dataApresentacao", "comissoes", "pareceres",
  "situacao", "resultadoVotacao", "lei", "dataConclusao", "linkOficial", "observacoes", "fonte", "verificacao", "eixoId",
];

const doForm = (form: FormData): Valores => Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));

export async function criarProposicaoAction(estado: EstadoProposicao, form: FormData): Promise<EstadoProposicao> {
  const ator = await exigirUsuario();
  const valores = doForm(form);
  let id = "";
  try {
    id = (await criarProposicao(prisma, ator, valores as unknown as ProposicaoEntrada, await metaRequisicao())).id;
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message, valores, n: (estado?.n ?? 0) + 1 };
    throw e;
  }
  revalidatePath("/oportunidades/historico");
  redirect(`/oportunidades/historico/${id}`);
}

export async function atualizarProposicaoAction(id: string, estado: EstadoProposicao, form: FormData): Promise<EstadoProposicao> {
  const ator = await exigirUsuario();
  const valores = doForm(form);
  try {
    await atualizarProposicao(prisma, ator, id, valores as unknown as ProposicaoEntrada, await metaRequisicao());
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message, valores, n: (estado?.n ?? 0) + 1 };
    throw e;
  }
  revalidatePath("/oportunidades/historico");
  revalidatePath(`/oportunidades/historico/${id}`);
  redirect(`/oportunidades/historico/${id}`);
}

export type ResultadoConferencia =
  | { erro: string }
  | { linhas: LinhaConferida[]; resumo: ReturnType<typeof resumoConferencia>; ignoradas: string[] }
  | { importadas: number; ignoradas: number };

const limpar = (linhas: unknown): Linha[] => {
  if (!Array.isArray(linhas) || linhas.length > 2000) return [];
  return linhas.map((l) => Object.fromEntries(CAMPOS_PLANILHA.map((c) => [c, typeof l?.[c] === "string" ? l[c].slice(0, 20000) : undefined]).filter(([, v]) => v)) as Linha);
};

const sem = (c: (LinhaConferida & { dados?: unknown })[]) => c.map(({ linha, valores, erros, avisos, duplicada, ok }) => ({ linha, valores, erros, avisos, duplicada, ok }));

export async function lerPlanilhaAction(form: FormData): Promise<ResultadoConferencia> {
  const ator = await exigirUsuario();
  try {
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo .xlsx ou .csv." };
    const { linhas, ignoradas } = await lerPlanilha(arquivo.name, Buffer.from(await arquivo.arrayBuffer()));
    const c = await conferirImportacao(prisma, ator, linhas, String(form.get("fonte") ?? ""));
    return { linhas: sem(c), resumo: resumoConferencia(c), ignoradas };
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message };
    throw e;
  }
}

export async function reconferirAction(linhas: Linha[], fonte: string): Promise<ResultadoConferencia> {
  const ator = await exigirUsuario();
  try {
    const c = await conferirImportacao(prisma, ator, limpar(linhas), String(fonte ?? ""));
    return { linhas: sem(c), resumo: resumoConferencia(c), ignoradas: [] };
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message };
    throw e;
  }
}

export async function importarAction(linhas: Linha[], fonte: string): Promise<ResultadoConferencia> {
  const ator = await exigirUsuario();
  try {
    const r = await importarProposicoes(prisma, ator, limpar(linhas), String(fonte ?? ""), await metaRequisicao());
    revalidatePath("/oportunidades/historico");
    return r;
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message };
    throw e;
  }
}

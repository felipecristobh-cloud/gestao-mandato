"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { exigirUsuario, metaRequisicao } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import type { EstadoForm } from "./parlamentares-actions";
import { anonimizarPessoa } from "./lgpd";

export async function anonimizarPessoaAction(pessoaId: string, demandaId: string, estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const n = (estado?.n ?? 0) + 1;
  const motivo = String(form.get("motivo") ?? "");
  if (form.get("confirmar") !== "ANONIMIZAR") return { erro: "Digite ANONIMIZAR para confirmar.", valores: { motivo }, n };
  try {
    const r = await anonimizarPessoa(prisma, ator, pessoaId, motivo, await metaRequisicao());
    revalidatePath(`/demandas/${demandaId}`);
    revalidatePath("/demandas");
    return { ok: `Solicitante anonimizado em ${r.demandas} demanda(s); ${r.arquivos} arquivo(s) removido(s).`, n };
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message, valores: { motivo }, n };
    throw e;
  }
}

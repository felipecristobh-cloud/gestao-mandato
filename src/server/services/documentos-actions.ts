"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { exigirUsuario, metaRequisicao } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import type { EstadoForm } from "./parlamentares-actions";
import { enviarDocumento, removerDocumento, vinculoDe, type Vinculo } from "./documentos";

const ROTA: Record<string, string> = { demanda: "/demandas", emenda: "/emendas", entidade: "/entidades" };

function revalidar(v: Vinculo) {
  revalidatePath("/documentos");
  if (v) revalidatePath(`${ROTA[v.tipo]}/${v.id}`);
}

export async function enviarDocumentoAction(tipo: string, id: string, estado: EstadoForm, form: FormData): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const n = (estado?.n ?? 0) + 1;
  const valores = { categoria: String(form.get("categoria") ?? ""), descricao: String(form.get("descricao") ?? "") };
  try {
    const vinculo = vinculoDe(tipo, id);
    const arquivo = form.get("arquivo");
    await enviarDocumento(prisma, ator, {
      arquivo: arquivo instanceof File ? arquivo : null, ...valores, restrito: form.get("restrito") === "1", vinculo,
    }, await metaRequisicao());
    revalidar(vinculo);
    return { ok: "Documento enviado.", n };
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message, valores, n };
    throw e;
  }
}

export async function removerDocumentoAction(id: string, estado: EstadoForm): Promise<EstadoForm> {
  const ator = await exigirUsuario();
  const n = (estado?.n ?? 0) + 1;
  try {
    const r = await removerDocumento(prisma, ator, id, await metaRequisicao());
    revalidar(r.demandaId ? { tipo: "demanda", id: r.demandaId } : r.emendaId ? { tipo: "emenda", id: r.emendaId } : r.entidadeId ? { tipo: "entidade", id: r.entidadeId } : null);
    return { ok: "Documento removido.", n };
  } catch (e) {
    if (e instanceof AppError) return { erro: e.message, n };
    throw e;
  }
}

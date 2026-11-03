import type { AcaoAuditoria, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { mascararEmail, mascararTelefone } from "@/lib/mascara";

const CAMPOS_OCULTOS = new Set(["senhaHash", "senha", "token"]);

/** Minimização (LGPD): a auditoria nunca guarda segredo, e guarda telefone e e-mail mascarados. */
export function sanitizar(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  return JSON.parse(
    JSON.stringify(valor, (k, v) => {
      if (CAMPOS_OCULTOS.has(k)) return undefined;
      if (k === "telefone" && typeof v === "string") return mascararTelefone(v) || null;
      if (k === "email" && typeof v === "string") return mascararEmail(v) || null;
      return v;
    }),
  ) as Prisma.InputJsonValue;
}

export type EntradaAuditoria = {
  usuarioId: string | null;
  entidade: string;
  registroId?: string | null;
  acao: AcaoAuditoria;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  descricao?: string;
  ip?: string;
};

/** Grava no audit_log. Use o `tx` da transação da alteração para gravar no mesmo commit. */
export async function registrarAuditoria(db: Db | Tx, e: EntradaAuditoria) {
  await db.auditLog.create({
    data: {
      usuarioId: e.usuarioId,
      entidade: e.entidade,
      registroId: e.registroId ?? null,
      acao: e.acao,
      valorAnterior: sanitizar(e.valorAnterior),
      valorNovo: sanitizar(e.valorNovo),
      descricao: e.descricao,
      ip: e.ip,
    },
  });
}

/** Campos que mudaram entre dois objetos, para registrar só a diferença. */
export function diferenca<T extends Record<string, unknown>>(antes: T, depois: Partial<T>) {
  const anterior: Record<string, unknown> = {};
  const novo: Record<string, unknown> = {};
  for (const k of Object.keys(depois)) {
    const a = antes[k];
    const d = depois[k];
    if (JSON.stringify(a) !== JSON.stringify(d)) {
      anterior[k] = a;
      novo[k] = d;
    }
  }
  return { anterior, novo, mudou: Object.keys(novo).length > 0 };
}

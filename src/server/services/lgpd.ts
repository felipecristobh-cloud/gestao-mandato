import type { Prisma } from "@prisma/client";
import type { Db } from "@/server/db";
import { registrarAuditoria } from "@/server/audit";
import { exigir, type Ator } from "@/server/authz";
import { naoEncontrado, validacao } from "@/server/errors";
import { storagePadrao, type Storage } from "@/server/storage";

export const NOME_ANONIMIZADO = "Titular anonimizado";
const CAMPOS_PESSOAIS = ["nome", "solicitanteNome", "telefone", "email", "endereco", "latitude", "longitude"];

function limparJson(v: Prisma.JsonValue | null, campos: string[]): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!v || typeof v !== "object" || Array.isArray(v)) return (v ?? null) as Prisma.InputJsonValue;
  const copia = { ...(v as Record<string, unknown>) };
  for (const c of campos) if (c in copia) copia[c] = "[anonimizado]";
  return copia as Prisma.InputJsonValue;
}

/**
 * Anonimiza o solicitante (pedido do titular, LGPD art. 18): apaga nome, contato, endereço e ponto exato,
 * remove os arquivos anexados às demandas dele e limpa esses dados da auditoria.
 * As demandas continuam existindo (protocolo, tema, bairro, status) para os números do mandato.
 */
export async function anonimizarPessoa(db: Db, ator: Ator, pessoaId: string, motivoBruto: string, meta: { ip?: string } = {}, storage: Storage = storagePadrao()) {
  exigir(ator, "lgpd:anonimizar");
  const motivo = motivoBruto.trim().slice(0, 500);
  if (motivo.length < 5) throw validacao("Informe o motivo da anonimização (ex.: pedido do titular em 05/10/2026).");
  const pessoa = await db.pessoa.findUnique({ where: { id: pessoaId }, include: { demandas: { select: { id: true } } } });
  if (!pessoa) throw naoEncontrado("Solicitante não encontrado.");
  if (pessoa.anonimizadoEm) throw validacao("Este solicitante já foi anonimizado.");
  const demandaIds = pessoa.demandas.map((d) => d.id);

  const removidos = await db.$transaction(async (tx) => {
    const docs = await tx.documento.findMany({ where: { demandaId: { in: demandaIds } }, select: { id: true, caminho: true } });
    await tx.pessoa.update({
      where: { id: pessoaId },
      data: { nome: NOME_ANONIMIZADO, telefone: null, email: null, endereco: null, anonimizadoEm: new Date() },
    });
    await tx.demanda.updateMany({ where: { pessoaId }, data: { endereco: null, latitude: null, longitude: null } });
    await tx.documento.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });

    const logs = await tx.auditLog.findMany({
      where: {
        OR: [
          { entidade: "pessoa", registroId: pessoaId },
          { entidade: "demanda", registroId: { in: demandaIds } },
          { entidade: "documento", registroId: { in: docs.map((d) => d.id) } },
        ],
      },
      select: { id: true, entidade: true, valorAnterior: true, valorNovo: true, descricao: true },
    });
    for (const l of logs) {
      const campos = l.entidade === "documento" ? [...CAMPOS_PESSOAIS, "descricao"] : CAMPOS_PESSOAIS;
      await tx.auditLog.update({
        where: { id: l.id },
        data: {
          valorAnterior: limparJson(l.valorAnterior, campos),
          valorNovo: limparJson(l.valorNovo, campos),
          ...(l.entidade === "documento" ? { descricao: null } : {}),
        },
      });
    }
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "pessoa", registroId: pessoaId, acao: "ANONIMIZAR",
      descricao: `Motivo: ${motivo} · ${demandaIds.length} demanda(s) · ${docs.length} arquivo(s) removido(s)`, ip: meta.ip,
    });
    return docs;
  });
  await Promise.all(removidos.map((d) => storage.remover(d.caminho).catch(() => undefined)));
  return { demandas: demandaIds.length, arquivos: removidos.length };
}

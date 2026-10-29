import { createHash } from "node:crypto";
import type { CategoriaDocumento, Prisma } from "@prisma/client";
import type { Db } from "@/server/db";
import { registrarAuditoria } from "@/server/audit";
import { exigir, pode, podeEditarRegistro, podeVerContato, proibir, type Ator } from "@/server/authz";
import { naoEncontrado, validacao } from "@/server/errors";
import { novaChave, storagePadrao, type Storage } from "@/server/storage";
import { CATEGORIAS_DOCUMENTO, TAMANHO_MAX, TIPOS_ACEITOS, conteudoConfere, extensao, formatarTamanho, nomeSeguro } from "@/lib/documentos";

export type TipoVinculo = "demanda" | "emenda" | "entidade";
export type Vinculo = { tipo: TipoVinculo; id: string } | null;
type Meta = { ip?: string };
type ArquivoEnviado = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

const UUID = /^[0-9a-f-]{36}$/i;
const COLUNA: Record<TipoVinculo, "demandaId" | "emendaId" | "entidadeId"> = { demanda: "demandaId", emenda: "emendaId", entidade: "entidadeId" };

const INCLUIR = {
  usuario: { select: { nome: true } },
  demanda: { select: { protocolo: true, responsavelId: true, criadoPorId: true } },
  emenda: { select: { numero: true, ano: true } },
  entidade: { select: { nome: true } },
} satisfies Prisma.DocumentoInclude;
type DocumentoCompleto = Prisma.DocumentoGetPayload<{ include: typeof INCLUIR }>;

export function vinculoDe(tipo: unknown, id: unknown): Vinculo {
  if (typeof tipo !== "string" || !tipo) return null;
  if (!(tipo in COLUNA) || typeof id !== "string" || !UUID.test(id)) throw validacao("Vínculo do documento inválido.");
  return { tipo: tipo as TipoVinculo, id };
}

/**
 * Quem abre o arquivo: precisa de dados:ver; restrito só com documentos_restritos:ver;
 * anexo de demanda segue a regra do contato do cidadão (costuma ter dado pessoal).
 */
export function podeAbrirDocumento(ator: Ator, d: { restrito: boolean; demandaId: string | null; demanda?: { responsavelId: string | null; criadoPorId: string | null } | null }) {
  if (!pode(ator, "dados:ver")) return false;
  if (d.restrito && !pode(ator, "documentos_restritos:ver")) return false;
  if (d.demandaId && !podeVerContato(ator, d.demanda ?? {})) return false;
  return true;
}

export function podeRemoverDocumento(ator: Ator, d: { usuarioId: string | null }) {
  return pode(ator, "dados:editar_todos") || (pode(ator, "dados:editar_proprios") && d.usuarioId === ator.id);
}

/** Registro ao qual o anexo se liga, com a regra de edição dele (o assessor só anexa nas próprias demandas/emendas). */
async function registroAlvo(db: Db, v: NonNullable<Vinculo>) {
  const sel = { responsavelId: true, criadoPorId: true } as const;
  const r =
    v.tipo === "demanda" ? await db.demanda.findUnique({ where: { id: v.id }, select: sel })
    : v.tipo === "emenda" ? await db.emenda.findUnique({ where: { id: v.id }, select: sel })
    : await db.entidade.findUnique({ where: { id: v.id }, select: { criadoPorId: true } });
  if (!r) throw naoEncontrado("Registro do documento não encontrado.");
  return r;
}

function exibir(ator: Ator, d: DocumentoCompleto) {
  const abrir = podeAbrirDocumento(ator, d);
  const { caminho: _caminho, hash: _hash, demanda, ...resto } = d;
  return {
    ...resto,
    nome: abrir ? d.nome : "Anexo da demanda (acesso só do responsável)",
    descricao: abrir ? d.descricao : null,
    demanda: demanda ? { protocolo: demanda.protocolo } : null,
    podeAbrir: abrir,
    podeRemover: abrir && podeRemoverDocumento(ator, d),
  };
}
export type DocumentoExibido = ReturnType<typeof exibir>;

function whereVisivel(ator: Ator): Prisma.DocumentoWhereInput {
  return pode(ator, "documentos_restritos:ver") ? {} : { restrito: false };
}

export async function documentosDe(db: Db, ator: Ator, v: NonNullable<Vinculo>) {
  exigir(ator, "dados:ver");
  const docs = await db.documento.findMany({
    where: { ...whereVisivel(ator), [COLUNA[v.tipo]]: v.id }, include: INCLUIR, orderBy: { criadoEm: "desc" },
  });
  return docs.map((d) => exibir(ator, d));
}

export type FiltrosDocumentos = { q?: string; categoria?: string; vinculo?: string; pagina?: number };

export async function listarDocumentos(db: Db, ator: Ator, f: FiltrosDocumentos = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 50;
  const pagina = Math.max(1, f.pagina ?? 1);
  const q = f.q?.trim().slice(0, 100);
  const where: Prisma.DocumentoWhereInput = {
    ...whereVisivel(ator),
    ...(f.categoria && (CATEGORIAS_DOCUMENTO as readonly string[]).includes(f.categoria) ? { categoria: f.categoria as CategoriaDocumento } : {}),
    ...(f.vinculo === "avulso" ? { demandaId: null, emendaId: null, entidadeId: null }
      : f.vinculo && f.vinculo in COLUNA ? { [COLUNA[f.vinculo as TipoVinculo]]: { not: null } } : {}),
  };
  // Busca por nome/descrição não alcança anexos de demanda que o usuário não pode abrir (o nome pode ter dado pessoal).
  if (q) {
    const texto: Prisma.DocumentoWhereInput = { OR: [{ nome: { contains: q, mode: "insensitive" } }, { descricao: { contains: q, mode: "insensitive" } }] };
    const demandaVisivel: Prisma.DocumentoWhereInput = pode(ator, "contatos:ver_todos") ? {}
      : ator.perfil === "CONSULTA" ? { demandaId: null }
      : { OR: [{ demandaId: null }, { demanda: { OR: [{ responsavelId: ator.id }, { criadoPorId: ator.id }] } }] };
    where.AND = [texto, demandaVisivel];
  }
  const [docs, total] = await Promise.all([
    db.documento.findMany({ where, include: INCLUIR, orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina }),
    db.documento.count({ where }),
  ]);
  return { itens: docs.map((d) => exibir(ator, d)), total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export type EntradaDocumento = { arquivo: ArquivoEnviado | null; categoria?: string; descricao?: string; restrito?: boolean; vinculo: Vinculo };

export async function enviarDocumento(db: Db, ator: Ator, e: EntradaDocumento, meta: Meta = {}, storage: Storage = storagePadrao()) {
  exigir(ator, "dados:criar");
  if (e.vinculo && !podeEditarRegistro(ator, await registroAlvo(db, e.vinculo))) {
    throw proibir("Você só pode anexar documentos em registros sob sua responsabilidade ou criados por você.");
  }
  if (e.restrito && !pode(ator, "documentos_restritos:ver")) throw proibir("Só Admin e Coordenação podem marcar um documento como restrito.");
  const arquivo = e.arquivo;
  if (!arquivo || arquivo.size === 0) throw validacao("Escolha um arquivo.");
  if (arquivo.size > TAMANHO_MAX) throw validacao(`O arquivo passa do limite de ${formatarTamanho(TAMANHO_MAX)}.`);
  const nome = nomeSeguro(arquivo.name);
  const ext = extensao(nome);
  const tipo = TIPOS_ACEITOS[ext];
  if (!tipo) throw validacao("Tipo de arquivo não aceito. Envie PDF, imagem (PNG, JPG, WEBP), Word, Excel ou ODT/ODS.");
  const dados = Buffer.from(await arquivo.arrayBuffer());
  if (!conteudoConfere(ext, dados)) throw validacao(`O conteúdo do arquivo não é um .${ext} válido.`);
  const categoria = (CATEGORIAS_DOCUMENTO as readonly string[]).includes(e.categoria ?? "") ? (e.categoria as CategoriaDocumento) : "OUTRO";
  const descricao = e.descricao?.trim().slice(0, 500) || null;

  const caminho = novaChave();
  await storage.salvar(caminho, dados);
  try {
    return await db.$transaction(async (tx) => {
      const d = await tx.documento.create({
        data: {
          nome, categoria, tipo: tipo.mime, tamanho: dados.length, caminho, hash: createHash("sha256").update(dados).digest("hex"),
          descricao, restrito: !!e.restrito, usuarioId: ator.id, ...(e.vinculo ? { [COLUNA[e.vinculo.tipo]]: e.vinculo.id } : {}),
        },
      });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "documento", registroId: d.id, acao: "CRIAR",
        valorNovo: { nome, categoria, tipo: tipo.mime, tamanho: d.tamanho, restrito: d.restrito, vinculo: e.vinculo }, ip: meta.ip,
      });
      return d;
    });
  } catch (err) {
    await storage.remover(caminho).catch(() => undefined);
    throw err;
  }
}

/** Lê o arquivo para download e registra quem baixou. */
export async function baixarDocumento(db: Db, ator: Ator, id: string, meta: Meta = {}, storage: Storage = storagePadrao()) {
  exigir(ator, "dados:ver");
  const d = UUID.test(id) ? await db.documento.findUnique({ where: { id }, include: INCLUIR }) : null;
  if (!d || (d.restrito && !pode(ator, "documentos_restritos:ver"))) throw naoEncontrado("Documento não encontrado.");
  if (!podeAbrirDocumento(ator, d)) throw proibir("Este anexo é da demanda de outro responsável.");
  const conteudo = await storage.ler(d.caminho);
  await registrarAuditoria(db, { usuarioId: ator.id, entidade: "documento", registroId: d.id, acao: "DOWNLOAD", descricao: d.nome, ip: meta.ip });
  return { nome: d.nome, tipo: d.tipo, conteudo };
}

export async function removerDocumento(db: Db, ator: Ator, id: string, meta: Meta = {}, storage: Storage = storagePadrao()) {
  const d = UUID.test(id) ? await db.documento.findUnique({ where: { id }, include: INCLUIR }) : null;
  if (!d || (d.restrito && !pode(ator, "documentos_restritos:ver"))) throw naoEncontrado("Documento não encontrado.");
  if (!podeAbrirDocumento(ator, d) || !podeRemoverDocumento(ator, d)) throw proibir("Você só pode remover documentos que você enviou.");
  await db.$transaction(async (tx) => {
    await tx.documento.delete({ where: { id } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "documento", registroId: id, acao: "EXCLUIR",
      valorAnterior: { nome: d.nome, categoria: d.categoria, tamanho: d.tamanho, restrito: d.restrito }, ip: meta.ip,
    });
  });
  await storage.remover(d.caminho).catch(() => undefined);
  return { demandaId: d.demandaId, emendaId: d.emendaId, entidadeId: d.entidadeId };
}

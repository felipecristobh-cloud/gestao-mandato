import type { Prisma, PrioridadeOportunidade } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import { ROTULO_PRIORIDADE_OPORTUNIDADE, calcularNotaFinal, classificarNota, prioridadeEfetiva } from "@/lib/oportunidades";
import {
  avaliacaoSchema, eixoSchema, oportunidadeSchema, prioridadeManualSchema, type AvaliacaoEntrada, type OportunidadeEntrada,
} from "@/lib/validacao/oportunidade";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

const ROTULO_CAMPO: Record<string, string> = {
  nome: "nome", problema: "problema social", descricaoProblema: "descrição", publico: "público beneficiado", objetivo: "objetivo",
  solucao: "solução legislativa", resultados: "resultados esperados", fundamentacao: "fundamentação jurídica",
  legislacaoRelacionada: "legislação relacionada", projetosSemelhantes: "projetos semelhantes", parceiros: "parceiros",
  eixoId: "eixo", responsavelId: "responsável", bairroIds: "bairros", regionalIds: "regionais",
};

/** Quem cadastrou, o responsável (assessor) ou quem edita tudo. */
export const podeEditarOportunidade = (ator: Ator, o: { criadoPorId: string | null; responsavelId: string | null }) => podeEditarRegistro(ator, o);

/** Mudar a prioridade na mão é decisão da coordenação. */
export const podeDefinirPrioridade = (ator: Ator) => podeEditarRegistro(ator, {}) && ator.perfil !== "ASSESSOR";

// ---------- consulta ----------

export type FiltrosOportunidade = { q?: string; eixo?: string; prioridade?: string; regional?: string; responsavel?: string; pagina?: number };

const FAIXA: Record<PrioridadeOportunidade, { gte: number; lte: number }> = {
  MAXIMA: { gte: 80, lte: 100 }, ALTA: { gte: 60, lte: 79 }, INTERMEDIARIA: { gte: 40, lte: 59 }, BAIXA: { gte: 0, lte: 39 },
};

function whereOportunidades(f: FiltrosOportunidade): Prisma.OportunidadeWhereInput {
  const e: Prisma.OportunidadeWhereInput[] = [];
  const q = f.q?.trim();
  if (q) e.push({ OR: [{ nome: { contains: q, mode: "insensitive" } }, { problema: { contains: q, mode: "insensitive" } }, { publico: { contains: q, mode: "insensitive" } }] });
  if (f.eixo && Number(f.eixo)) e.push({ eixoId: Number(f.eixo) });
  if (f.regional && Number(f.regional)) {
    const id = Number(f.regional);
    e.push({ OR: [{ regionais: { some: { regionalId: id } } }, { bairros: { some: { bairro: { regionalId: id } } } }] });
  }
  if (f.responsavel === "nenhum") e.push({ responsavelId: null });
  else if (f.responsavel && /^[0-9a-f-]{36}$/i.test(f.responsavel)) e.push({ responsavelId: f.responsavel });
  if (f.prioridade === "SEM") e.push({ prioridadeManual: null, notaFinal: null });
  else if (f.prioridade && f.prioridade in FAIXA) {
    const p = f.prioridade as PrioridadeOportunidade;
    e.push({ OR: [{ prioridadeManual: p }, { prioridadeManual: null, notaFinal: FAIXA[p] }] });
  }
  return e.length ? { AND: e } : {};
}

export async function listarOportunidades(db: Db, ator: Ator, f: FiltrosOportunidade = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereOportunidades(f);
  const [itens, total] = await Promise.all([
    db.oportunidade.findMany({
      where,
      orderBy: [{ notaFinal: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true, nome: true, problema: true, notaFinal: true, prioridadeManual: true, criadoEm: true,
        eixo: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        regionais: { select: { regional: { select: { nome: true } } } },
      },
    }),
    db.oportunidade.count({ where }),
  ]);
  return { itens: itens.map((o) => ({ ...o, prioridade: prioridadeEfetiva(o) })), total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function obterOportunidade(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const o = await db.oportunidade.findUnique({
    where: { id },
    include: {
      eixo: true,
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      bairros: { include: { bairro: { include: { regional: { select: { nome: true } } } } }, orderBy: { bairro: { nome: "asc" } } },
      regionais: { include: { regional: true }, orderBy: { regional: { nome: "asc" } } },
      historico: { orderBy: { data: "desc" }, take: 100, include: { usuario: { select: { nome: true } } } },
    },
  });
  if (!o) throw naoEncontrado("Oportunidade não encontrada.");
  return {
    ...o,
    prioridade: prioridadeEfetiva(o),
    prioridadeCalculada: o.notaFinal === null ? null : classificarNota(o.notaFinal),
    podeEditar: podeEditarOportunidade(ator, o),
    podePriorizar: podeDefinirPrioridade(ator),
  };
}

export async function opcoesFormOportunidade(db: Db, incluirEixoId?: number | null) {
  const [eixos, regionais, usuarios] = await Promise.all([
    db.eixoLegislativo.findMany({ where: { OR: [{ ativo: true }, ...(incluirEixoId ? [{ id: incluirEixoId }] : [])] }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.regional.findMany({ orderBy: { nome: "asc" }, include: { bairros: { orderBy: { nome: "asc" }, select: { id: true, nome: true } } } }),
    db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return { eixos, regionais, usuarios };
}

// ---------- escrita ----------

function normalizar(entrada: OportunidadeEntrada) {
  const r = oportunidadeSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  return r.data;
}

async function validarReferencias(db: Db | Tx, d: ReturnType<typeof normalizar>, eixoAtual?: number) {
  const eixo = await db.eixoLegislativo.findUnique({ where: { id: d.eixoId } });
  if (!eixo || (!eixo.ativo && eixo.id !== eixoAtual)) throw validacao("Eixo temático inválido.");
  if (d.responsavelId && !(await db.usuario.findFirst({ where: { id: d.responsavelId, ativo: true } }))) throw validacao("Responsável inválido.");
  if (d.bairroIds.length && (await db.bairro.count({ where: { id: { in: d.bairroIds } } })) !== d.bairroIds.length) throw validacao("Bairro inválido.");
  if (d.regionalIds.length && (await db.regional.count({ where: { id: { in: d.regionalIds } } })) !== d.regionalIds.length) throw validacao("Regional inválida.");
}

const separar = ({ bairroIds, regionalIds, ...dados }: ReturnType<typeof normalizar>) => ({ dados, bairroIds, regionalIds });

export async function criarOportunidade(db: Db, ator: Ator, entrada: OportunidadeEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const n = normalizar(entrada);
  await validarReferencias(db, n);
  const { dados, bairroIds, regionalIds } = separar(n);
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.create({
      data: {
        ...dados, criadoPorId: ator.id,
        bairros: { create: bairroIds.map((bairroId) => ({ bairroId })) },
        regionais: { create: regionalIds.map((regionalId) => ({ regionalId })) },
      },
    });
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: o.id, usuarioId: ator.id, tipo: "CRIACAO", descricao: "Ideia cadastrada." } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "oportunidade", registroId: o.id, acao: "CRIAR", valorNovo: { ...o, bairroIds, regionalIds },
      descricao: `Oportunidade legislativa cadastrada: ${o.nome}.`, ip: meta.ip,
    });
    return o;
  });
}

async function carregarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const o = await db.oportunidade.findUnique({ where: { id }, include: { bairros: true, regionais: true } });
  if (!o) throw naoEncontrado("Oportunidade não encontrada.");
  if (!podeEditarOportunidade(ator, o)) throw proibir("Você só pode editar oportunidades que você cadastrou ou pelas quais é responsável.");
  return o;
}

export async function atualizarOportunidade(db: Db, ator: Ator, id: string, entrada: OportunidadeEntrada, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  const atual = await carregarParaEditar(db, ator, id);
  const n = normalizar(entrada);
  await validarReferencias(db, n, atual.eixoId);
  const { dados, bairroIds, regionalIds } = separar(n);
  const antes = {
    ...Object.fromEntries(Object.keys(dados).map((k) => [k, atual[k as keyof typeof atual]])),
    bairroIds: atual.bairros.map((b) => b.bairroId).sort((a, b) => a - b),
    regionalIds: atual.regionais.map((r) => r.regionalId).sort((a, b) => a - b),
  };
  const depois = { ...dados, bairroIds: [...bairroIds].sort((a, b) => a - b), regionalIds: [...regionalIds].sort((a, b) => a - b) };
  const d = diferenca(antes, depois);
  if (!d.mudou) return atual;
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.update({
      where: { id },
      data: {
        ...dados,
        bairros: { deleteMany: {}, create: bairroIds.map((bairroId) => ({ bairroId })) },
        regionais: { deleteMany: {}, create: regionalIds.map((regionalId) => ({ regionalId })) },
      },
    });
    const campos = Object.keys(d.novo).map((k) => ROTULO_CAMPO[k] ?? k).join(", ");
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "EDICAO", descricao: `Alterou: ${campos}.` } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "oportunidade", registroId: id, acao: "EDITAR", valorAnterior: d.anterior, valorNovo: d.novo,
      descricao: `Oportunidade editada (${campos}).`, ip: meta.ip,
    });
    return o;
  });
}

export async function avaliarOportunidade(db: Db, ator: Ator, id: string, entrada: AvaliacaoEntrada, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  const atual = await carregarParaEditar(db, ator, id);
  const r = avaliacaoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const notaFinal = calcularNotaFinal(r.data)!;
  const anterior = { notaImpacto: atual.notaImpacto, notaAlcance: atual.notaAlcance, notaViabilidade: atual.notaViabilidade, notaExecucao: atual.notaExecucao, notaInovacao: atual.notaInovacao, notaFinal: atual.notaFinal };
  const d = diferenca(anterior, { ...r.data, notaFinal });
  if (!d.mudou) return atual;
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.update({ where: { id }, data: { ...r.data, notaFinal } });
    const desc = `Avaliação: nota ${notaFinal} de 100 (${ROTULO_PRIORIDADE_OPORTUNIDADE[classificarNota(notaFinal)].toLowerCase()})${atual.notaFinal !== null ? `; antes era ${atual.notaFinal}` : ""}.`;
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "AVALIACAO", descricao: desc } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "oportunidade", registroId: id, acao: "EDITAR", valorAnterior: d.anterior, valorNovo: d.novo, descricao: desc, ip: meta.ip });
    return o;
  });
}

/** Prioridade manual (ou volta à automática, com prioridade vazia). Justificativa sempre obrigatória e guardada no histórico. */
export async function definirPrioridadeManual(db: Db, ator: Ator, id: string, entrada: { prioridade?: string | null; justificativa?: string }, meta: Meta = {}) {
  if (!podeDefinirPrioridade(ator)) throw proibir("Só a coordenação pode mudar a prioridade manualmente.");
  const r = prioridadeManualSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const atual = await db.oportunidade.findUnique({ where: { id } });
  if (!atual) throw naoEncontrado("Oportunidade não encontrada.");
  const prioridade = r.data.prioridade as PrioridadeOportunidade | null;
  if (prioridade === atual.prioridadeManual) throw conflito(prioridade ? "A prioridade manual já é essa." : "A prioridade já é a automática.");
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.update({ where: { id }, data: { prioridadeManual: prioridade, justificativaPrioridade: prioridade ? r.data.justificativa : null } });
    const de = atual.prioridadeManual ? ROTULO_PRIORIDADE_OPORTUNIDADE[atual.prioridadeManual] : "automática";
    const para = prioridade ? ROTULO_PRIORIDADE_OPORTUNIDADE[prioridade] : "automática";
    const desc = `Prioridade manual: ${de} → ${para}. Justificativa: ${r.data.justificativa}`;
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "PRIORIDADE", descricao: desc } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "oportunidade", registroId: id, acao: "EDITAR",
      valorAnterior: { prioridadeManual: atual.prioridadeManual }, valorNovo: { prioridadeManual: prioridade, justificativa: r.data.justificativa }, descricao: desc, ip: meta.ip,
    });
    return o;
  });
}

// ---------- eixos temáticos ----------

export async function listarEixos(db: Db, ator: Ator) {
  exigir(ator, "dados:ver");
  return db.eixoLegislativo.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { oportunidades: true } } } });
}

export async function criarEixo(db: Db, ator: Ator, entrada: { nome?: string }, meta: Meta = {}) {
  exigir(ator, "cadastros_base:gerenciar");
  const r = eixoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const existe = await db.eixoLegislativo.findFirst({ where: { nome: { equals: r.data.nome, mode: "insensitive" } } });
  if (existe) throw conflito(`Já existe o eixo ${existe.nome}${existe.ativo ? "" : " (inativo)"}.`);
  try {
    return await db.$transaction(async (tx) => {
      const e = await tx.eixoLegislativo.create({ data: { nome: r.data.nome } });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "eixo_legislativo", registroId: String(e.id), acao: "CRIAR", valorNovo: e, descricao: `Eixo temático criado: ${e.nome}.`, ip: meta.ip });
      return e;
    });
  } catch (e) {
    if (ehUnico(e)) throw conflito("Já existe eixo com esse nome.");
    throw e;
  }
}

export async function alternarEixo(db: Db, ator: Ator, id: number, meta: Meta = {}) {
  exigir(ator, "cadastros_base:gerenciar");
  const atual = await db.eixoLegislativo.findUnique({ where: { id } });
  if (!atual) throw naoEncontrado("Eixo não encontrado.");
  return db.$transaction(async (tx) => {
    const e = await tx.eixoLegislativo.update({ where: { id }, data: { ativo: !atual.ativo } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "eixo_legislativo", registroId: String(id), acao: "EDITAR", valorAnterior: { ativo: atual.ativo }, valorNovo: { ativo: e.ativo },
      descricao: `Eixo ${e.nome} ${e.ativo ? "reativado" : "inativado"}.`, ip: meta.ip,
    });
    return e;
  });
}

import type { ParticipacaoProposicao, Prisma, TipoProposicao, VerificacaoProposicao } from "@prisma/client";
import type { Db } from "@/server/db";
import { exigir, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import {
  MANDATOS_PEDRO, PARTICIPACOES, ROTULO_VERIFICACAO, TIPOS_PROPOSICAO, VERIFICACOES, rotuloProposicao, semAcento,
} from "@/lib/proposicoes";
import { CAMPOS_RECOMENDADOS, proposicaoSchema, type ProposicaoDados, type ProposicaoEntrada } from "@/lib/validacao/proposicao";
import type { Linha } from "@/server/proposicoes/planilha";

type Meta = { ip?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

function normalizar(entrada: ProposicaoEntrada): ProposicaoDados {
  const r = proposicaoSchema.safeParse(entrada);
  if (!r.success) throw validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

async function validarEixo(db: Db, eixoId: number | null, atual?: number | null) {
  if (eixoId === null) return;
  const e = await db.eixoLegislativo.findUnique({ where: { id: eixoId } });
  if (!e || (!e.ativo && e.id !== atual)) throw validacao("Eixo temático inválido.");
}

export const podeEditarProposicao = (ator: Ator, p: { criadoPorId: string | null }) => podeEditarRegistro(ator, p);

// ---------- consulta ----------

export type FiltrosProposicao = {
  q?: string; ano?: string; mandato?: string; eixo?: string; tipo?: string; participacao?: string; situacao?: string; verificacao?: string; pagina?: number;
};

function whereProposicoes(f: FiltrosProposicao): Prisma.ProposicaoWhereInput {
  const e: Prisma.ProposicaoWhereInput[] = [];
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    const num = /^\d+$/.test(q) ? Number(q) : null;
    e.push({ OR: [{ ementa: { contains: q, mode: "insensitive" } }, { descricao: { contains: q, mode: "insensitive" } }, { lei: { contains: q, mode: "insensitive" } }, ...(num ? [{ numero: num }] : [])] });
  }
  if (f.ano && Number(f.ano)) e.push({ ano: Number(f.ano) });
  const m = MANDATOS_PEDRO.find((x) => String(x.numero) === f.mandato);
  if (m) e.push({ ano: { gte: m.inicio, lte: m.fim } });
  if (f.eixo === "nenhum") e.push({ eixoId: null });
  else if (f.eixo && Number(f.eixo)) e.push({ eixoId: Number(f.eixo) });
  if (f.tipo && (TIPOS_PROPOSICAO as string[]).includes(f.tipo)) e.push({ tipo: f.tipo as TipoProposicao });
  if (f.participacao && (PARTICIPACOES as string[]).includes(f.participacao)) e.push({ participacao: f.participacao as ParticipacaoProposicao });
  if (f.verificacao && (VERIFICACOES as string[]).includes(f.verificacao)) e.push({ verificacao: f.verificacao as VerificacaoProposicao });
  if (f.situacao?.trim()) e.push({ situacao: { contains: f.situacao.trim().slice(0, 100), mode: "insensitive" } });
  return e.length ? { AND: e } : {};
}

export async function listarProposicoes(db: Db, ator: Ator, f: FiltrosProposicao = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 50;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereProposicoes(f);
  const [itens, total, porAno] = await Promise.all([
    db.proposicao.findMany({
      where, orderBy: [{ ano: "desc" }, { tipo: "asc" }, { numero: "desc" }], skip: (pagina - 1) * porPagina, take: porPagina,
      select: { id: true, tipo: true, numero: true, ano: true, ementa: true, participacao: true, situacao: true, verificacao: true, eixo: { select: { nome: true } } },
    }),
    db.proposicao.count({ where }),
    db.proposicao.groupBy({ by: ["ano"], _count: { _all: true } }),
  ]);
  const porMandato = MANDATOS_PEDRO.map((m) => ({
    ...m, total: porAno.filter((a) => a.ano >= m.inicio && a.ano <= m.fim).reduce((s, a) => s + a._count._all, 0),
  }));
  return { itens, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)), porMandato };
}

export async function obterProposicao(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const p = UUID.test(id) ? await db.proposicao.findUnique({
    where: { id },
    include: {
      eixo: true, criadoPor: { select: { nome: true } },
      historico: { orderBy: { data: "desc" }, take: 100, include: { usuario: { select: { nome: true } } } },
    },
  }) : null;
  if (!p) throw naoEncontrado("Proposição não encontrada.");
  return { ...p, podeEditar: podeEditarProposicao(ator, p) };
}

// ---------- escrita ----------

const jaExiste = (d: { tipo: TipoProposicao; numero: number; ano: number }) => conflito(`Já existe ${rotuloProposicao(d)} no histórico.`);

export async function criarProposicao(db: Db, ator: Ator, entrada: ProposicaoEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const d = normalizar(entrada);
  await validarEixo(db, d.eixoId);
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.proposicao.create({ data: { ...d, criadoPorId: ator.id } });
      await tx.proposicaoHistorico.create({ data: { proposicaoId: p.id, usuarioId: ator.id, tipo: "CRIACAO", descricao: `Cadastrada (fonte: ${d.fonte}).` } });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "proposicao", registroId: p.id, acao: "CRIAR", valorNovo: p, descricao: `Proposição ${rotuloProposicao(p)} cadastrada.`, ip: meta.ip });
      return p;
    });
  } catch (e) {
    if (ehUnico(e)) throw jaExiste(d);
    throw e;
  }
}

export async function atualizarProposicao(db: Db, ator: Ator, id: string, entrada: ProposicaoEntrada, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  const atual = UUID.test(id) ? await db.proposicao.findUnique({ where: { id } }) : null;
  if (!atual) throw naoEncontrado("Proposição não encontrada.");
  if (!podeEditarProposicao(ator, atual)) throw proibir("Você só pode editar proposições que você cadastrou.");
  const d = normalizar(entrada);
  await validarEixo(db, d.eixoId, atual.eixoId);
  const antes = Object.fromEntries(Object.keys(d).map((k) => [k, atual[k as keyof typeof atual]]));
  const dif = diferenca(antes, d);
  if (!dif.mudou) return atual;
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.proposicao.update({ where: { id }, data: d });
      const campos = Object.keys(dif.novo).filter((k) => k !== "verificacao");
      if (campos.length) await tx.proposicaoHistorico.create({ data: { proposicaoId: id, usuarioId: ator.id, tipo: "EDICAO", descricao: `Alterou: ${campos.join(", ")}.` } });
      if (atual.verificacao !== p.verificacao) {
        await tx.proposicaoHistorico.create({
          data: { proposicaoId: id, usuarioId: ator.id, tipo: "VERIFICACAO", descricao: `Verificação: ${ROTULO_VERIFICACAO[atual.verificacao]} → ${ROTULO_VERIFICACAO[p.verificacao]}.` },
        });
      }
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "proposicao", registroId: id, acao: "EDITAR", valorAnterior: dif.anterior, valorNovo: dif.novo,
        descricao: `Proposição ${rotuloProposicao(p)} editada.`, ip: meta.ip,
      });
      return p;
    });
  } catch (e) {
    if (ehUnico(e)) throw jaExiste(d);
    throw e;
  }
}

// ---------- importação ----------

export type LinhaConferida = {
  linha: number;
  valores: Linha;
  erros: string[];
  avisos: string[];
  duplicada: "banco" | "planilha" | null;
  ok: boolean;
};

const chave = (d: { tipo: string; numero: number; ano: number }) => `${d.tipo}|${d.numero}|${d.ano}`;

/** Confere cada linha: validação, duplicadas (no banco e dentro da própria planilha) e campos incompletos. Não grava nada. */
export async function conferirImportacao(db: Db, ator: Ator, linhas: Linha[], fontePadrao = "") {
  exigir(ator, "dados:criar");
  const eixos = await db.eixoLegislativo.findMany({ select: { id: true, nome: true, ativo: true } });
  const eixoPorNome = new Map(eixos.map((e) => [semAcento(e.nome), e]));
  const vistos = new Map<string, number>();
  const parciais = linhas.map((valores, i) => {
    const erros: string[] = [];
    const avisos: string[] = [];
    let eixoId: number | null = null;
    if (valores.eixo) {
      const e = eixoPorNome.get(semAcento(valores.eixo));
      if (!e) erros.push(`Eixo desconhecido: "${valores.eixo}".`);
      else if (!e.ativo) erros.push(`O eixo "${e.nome}" está inativo.`);
      else eixoId = e.id;
    }
    const r = proposicaoSchema.safeParse({ ...valores, fonte: valores.fonte || fontePadrao, eixoId });
    let dados: ProposicaoDados | null = null;
    if (!r.success) erros.push(...[...new Set(r.error.issues.map((x) => x.message))]);
    else {
      dados = r.data;
      for (const [campo, rotulo] of CAMPOS_RECOMENDADOS) if (!dados[campo]) avisos.push(`Sem ${rotulo}.`);
    }
    let duplicada: LinhaConferida["duplicada"] = null;
    if (dados) {
      const k = chave(dados);
      if (vistos.has(k)) { duplicada = "planilha"; erros.push(`Repetida na planilha (igual à linha ${vistos.get(k)}).`); }
      else vistos.set(k, i + 2);
    }
    return { linha: i + 2, valores, erros, avisos, duplicada, dados };
  });
  const validas = parciais.filter((p) => p.dados && !p.duplicada).map((p) => p.dados!);
  const existentes = validas.length
    ? await db.proposicao.findMany({ where: { OR: validas.map((d) => ({ tipo: d.tipo, numero: d.numero, ano: d.ano })) }, select: { tipo: true, numero: true, ano: true } })
    : [];
  const noBanco = new Set(existentes.map(chave));
  const conferidas: (LinhaConferida & { dados: ProposicaoDados | null })[] = parciais.map((p) => {
    if (p.dados && !p.duplicada && noBanco.has(chave(p.dados))) {
      return { ...p, duplicada: "banco" as const, erros: [...p.erros, `${rotuloProposicao(p.dados)} já está no histórico.`], ok: false };
    }
    return { ...p, ok: p.erros.length === 0 };
  });
  return conferidas;
}

export function resumoConferencia(c: LinhaConferida[]) {
  return {
    total: c.length,
    prontas: c.filter((l) => l.ok).length,
    comErro: c.filter((l) => !l.ok && !l.duplicada).length,
    duplicadas: c.filter((l) => l.duplicada).length,
    incompletas: c.filter((l) => l.ok && l.avisos.length).length,
  };
}

/** Grava só as linhas válidas e não duplicadas, tudo numa transação. */
export async function importarProposicoes(db: Db, ator: Ator, linhas: Linha[], fontePadrao = "", meta: Meta = {}) {
  const conferidas = await conferirImportacao(db, ator, linhas, fontePadrao);
  const prontas = conferidas.filter((l) => l.ok && l.dados);
  if (prontas.length === 0) throw validacao("Nenhuma linha pronta para importar. Corrija os erros apontados.");
  try {
    await db.$transaction(async (tx) => {
      for (const l of prontas) {
        const p = await tx.proposicao.create({ data: { ...l.dados!, criadoPorId: ator.id } });
        await tx.proposicaoHistorico.create({ data: { proposicaoId: p.id, usuarioId: ator.id, tipo: "IMPORTACAO", descricao: `Importada da planilha (linha ${l.linha}; fonte: ${p.fonte}).` } });
      }
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "proposicao", acao: "CRIAR", valorNovo: { importadas: prontas.length, ignoradas: conferidas.length - prontas.length },
        descricao: `Importação de planilha: ${prontas.length} proposições gravadas, ${conferidas.length - prontas.length} ignoradas.`, ip: meta.ip,
      });
    }, { timeout: 60_000 });
  } catch (e) {
    if (ehUnico(e)) throw conflito("Alguém cadastrou uma dessas proposições agora. Confira de novo antes de importar.");
    throw e;
  }
  return { importadas: prontas.length, ignoradas: conferidas.length - prontas.length };
}

export async function opcoesProposicao(db: Db, incluirEixoId?: number | null) {
  return db.eixoLegislativo.findMany({
    where: { OR: [{ ativo: true }, ...(incluirEixoId ? [{ id: incluirEixoId }] : [])] }, orderBy: { nome: "asc" }, select: { id: true, nome: true },
  });
}

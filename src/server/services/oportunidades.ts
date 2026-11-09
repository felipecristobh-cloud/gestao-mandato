import type { EtapaOportunidade, Prisma, PrioridadeOportunidade, TipoTextoOportunidade } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import {
  ETAPAS_COORDENACAO, ETAPAS_OPORTUNIDADE, ROTULO_ETAPA, ROTULO_PRIORIDADE_OPORTUNIDADE, ROTULO_TEXTO, TEXTOS_OPORTUNIDADE, calcularNotaFinal, classificarNota,
  prioridadeEfetiva,
} from "@/lib/oportunidades";
import {
  avaliacaoSchema, eixoSchema, etapaSchema, oportunidadeSchema, prioridadeManualSchema, textoSchema, vinculoSchema, type AvaliacaoEntrada,
  type OportunidadeEntrada,
} from "@/lib/validacao/oportunidade";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const UUID = /^[0-9a-f-]{36}$/i;
const uuid = (v: string) => {
  if (!UUID.test(v)) throw validacao("Identificador inválido.");
  return v;
};

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

export type FiltrosOportunidade = {
  q?: string; eixo?: string; prioridade?: string; regional?: string; responsavel?: string; etapa?: string; origem?: string; pagina?: number;
};

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
  if (f.etapa && (ETAPAS_OPORTUNIDADE as string[]).includes(f.etapa)) e.push({ etapa: f.etapa as EtapaOportunidade });
  if (f.origem === "demanda") e.push({ demandaOrigemId: { not: null } });
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
        id: true, nome: true, problema: true, notaFinal: true, prioridadeManual: true, criadoEm: true, etapa: true, demandaOrigemId: true,
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
      demandaOrigem: { select: { id: true, protocolo: true } },
      textos: { orderBy: { versao: "desc" }, include: { autor: { select: { nome: true } } } },
      vinculos: {
        orderBy: { criadoEm: "asc" },
        include: {
          demanda: { select: { id: true, protocolo: true, tema: { select: { nome: true } } } },
          emenda: { select: { id: true, codigo: true, objeto: true } },
          compromisso: { select: { id: true, titulo: true, inicio: true } },
        },
      },
    },
  });
  if (!o) throw naoEncontrado("Oportunidade não encontrada.");
  return {
    ...o,
    prioridade: prioridadeEfetiva(o),
    prioridadeCalculada: o.notaFinal === null ? null : classificarNota(o.notaFinal),
    podeEditar: podeEditarOportunidade(ator, o),
    podePriorizar: podeDefinirPrioridade(ator),
    textosAtuais: TEXTOS_OPORTUNIDADE.map((t) => ({ ...t, atual: o.textos.find((x) => x.tipo === t.tipo) ?? null, versoes: o.textos.filter((x) => x.tipo === t.tipo).length })),
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

/** De onde a ideia surgiu. A demanda/compromisso de origem não é alterado. */
export type OrigemOportunidade = { demandaId?: string | null; compromissoId?: string | null };

export async function criarOportunidade(db: Db, ator: Ator, entrada: OportunidadeEntrada, meta: Meta = {}, origem: OrigemOportunidade = {}) {
  exigir(ator, "dados:criar");
  const n = normalizar(entrada);
  await validarReferencias(db, n);
  const { dados, bairroIds, regionalIds } = separar(n);
  const demanda = origem.demandaId ? await db.demanda.findUnique({ where: { id: uuid(origem.demandaId) }, select: { id: true, protocolo: true } }) : null;
  if (origem.demandaId && !demanda) throw validacao("Demanda de origem não encontrada.");
  const compromisso = origem.compromissoId ? await db.compromisso.findUnique({ where: { id: uuid(origem.compromissoId) }, select: { id: true, titulo: true } }) : null;
  if (origem.compromissoId && !compromisso) throw validacao("Compromisso de origem não encontrado.");
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.create({
      data: {
        ...dados, criadoPorId: ator.id, demandaOrigemId: demanda?.id ?? null,
        bairros: { create: bairroIds.map((bairroId) => ({ bairroId })) },
        regionais: { create: regionalIds.map((regionalId) => ({ regionalId })) },
        vinculos: {
          create: [
            ...(demanda ? [{ demandaId: demanda.id, usuarioId: ator.id }] : []),
            ...(compromisso ? [{ compromissoId: compromisso.id, usuarioId: ator.id }] : []),
          ],
        },
      },
    });
    const de = demanda ? ` a partir da demanda ${demanda.protocolo}` : compromisso ? ` a partir do compromisso "${compromisso.titulo}"` : "";
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: o.id, usuarioId: ator.id, tipo: "CRIACAO", descricao: `Ideia cadastrada${de}.` } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "oportunidade", registroId: o.id, acao: "CRIAR",
      valorNovo: { ...o, bairroIds, regionalIds, compromissoOrigemId: compromisso?.id ?? null },
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

// ---------- desenvolvimento: etapas, textos e vínculos ----------

export async function alterarEtapa(db: Db, ator: Ator, id: string, entrada: { etapa?: string; observacao?: string | null }, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  const atual = await carregarParaEditar(db, ator, id);
  const r = etapaSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const etapa = r.data.etapa as EtapaOportunidade;
  if (etapa === atual.etapa) throw conflito("A proposta já está nessa etapa.");
  if ((ETAPAS_COORDENACAO.has(etapa) || ETAPAS_COORDENACAO.has(atual.etapa)) && !podeDefinirPrioridade(ator)) {
    throw proibir("Da validação do vereador em diante (e para arquivar ou suspender), só a coordenação muda a etapa.");
  }
  return db.$transaction(async (tx) => {
    const o = await tx.oportunidade.update({ where: { id }, data: { etapa } });
    const desc = `Etapa: ${ROTULO_ETAPA[atual.etapa]} → ${ROTULO_ETAPA[etapa]}.${r.data.observacao ? ` ${r.data.observacao}` : ""}`;
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "ETAPA", descricao: desc } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "oportunidade", registroId: id, acao: "EDITAR", valorAnterior: { etapa: atual.etapa }, valorNovo: { etapa }, descricao: desc, ip: meta.ip,
    });
    return o;
  });
}

/** Cada salvamento cria uma versão nova (as anteriores ficam guardadas). */
export async function salvarTexto(db: Db, ator: Ator, id: string, entrada: { tipo?: string; conteudo?: string }, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  await carregarParaEditar(db, ator, id);
  const r = textoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const tipo = r.data.tipo as TipoTextoOportunidade;
  if (TEXTOS_OPORTUNIDADE.find((t) => t.tipo === tipo)?.coordenacao && !podeDefinirPrioridade(ator)) throw proibir("Só a coordenação registra a versão final aprovada.");
  const ultima = await db.oportunidadeTexto.findFirst({ where: { oportunidadeId: id, tipo }, orderBy: { versao: "desc" } });
  if (ultima && ultima.conteudo === r.data.conteudo) throw conflito("O texto não mudou desde a última versão.");
  const versao = (ultima?.versao ?? 0) + 1;
  try {
    return await db.$transaction(async (tx) => {
      const t = await tx.oportunidadeTexto.create({ data: { oportunidadeId: id, tipo, versao, conteudo: r.data.conteudo, autorId: ator.id } });
      await tx.oportunidade.update({ where: { id }, data: { atualizadoEm: new Date() } });
      const desc = `${ROTULO_TEXTO[tipo]}: versão ${versao} salva.`;
      await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "TEXTO", descricao: desc } });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "oportunidade_texto", registroId: t.id, acao: "CRIAR", valorNovo: { oportunidadeId: id, tipo, versao, caracteres: t.conteudo.length },
        descricao: desc, ip: meta.ip,
      });
      return t;
    });
  } catch (e) {
    if (ehUnico(e)) throw conflito("Outra pessoa salvou uma versão deste texto agora. Recarregue a página e confira antes de salvar.");
    throw e;
  }
}

export async function versoesTexto(db: Db, ator: Ator, id: string, tipo: string) {
  exigir(ator, "dados:ver");
  if (!TEXTOS_OPORTUNIDADE.some((t) => t.tipo === tipo)) throw naoEncontrado("Texto não encontrado.");
  const o = await db.oportunidade.findUnique({ where: { id: uuid(id) }, select: { id: true, nome: true } });
  if (!o) throw naoEncontrado("Oportunidade não encontrada.");
  const versoes = await db.oportunidadeTexto.findMany({
    where: { oportunidadeId: id, tipo: tipo as TipoTextoOportunidade }, orderBy: { versao: "desc" }, include: { autor: { select: { nome: true } } },
  });
  return { oportunidade: o, tipo: tipo as TipoTextoOportunidade, versoes };
}

async function alvoVinculo(db: Db, tipo: "demanda" | "emenda" | "compromisso", ref: string) {
  if (tipo === "demanda") {
    const d = await db.demanda.findFirst({ where: UUID.test(ref) ? { id: ref } : { protocolo: { equals: ref.toUpperCase() } }, select: { id: true, protocolo: true } });
    if (!d) throw validacao("Demanda não encontrada. Confira o protocolo (ex.: DEM-2026-00001).");
    return { dados: { demandaId: d.id }, rotulo: `demanda ${d.protocolo}` };
  }
  if (tipo === "emenda") {
    const e = UUID.test(ref) ? await db.emenda.findUnique({ where: { id: ref }, select: { id: true, codigo: true } }) : null;
    if (!e) throw validacao("Emenda não encontrada.");
    return { dados: { emendaId: e.id }, rotulo: `emenda ${e.codigo}` };
  }
  const c = UUID.test(ref) ? await db.compromisso.findUnique({ where: { id: ref }, select: { id: true, titulo: true } }) : null;
  if (!c) throw validacao("Compromisso não encontrado.");
  return { dados: { compromissoId: c.id }, rotulo: `compromisso "${c.titulo}"` };
}

export async function vincularOportunidade(db: Db, ator: Ator, id: string, entrada: { tipo?: string; ref?: string }, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  await carregarParaEditar(db, ator, id);
  const r = vinculoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const alvo = await alvoVinculo(db, r.data.tipo, r.data.ref);
  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.oportunidadeVinculo.create({ data: { oportunidadeId: id, usuarioId: ator.id, ...alvo.dados } });
      const desc = `Vinculou a ${alvo.rotulo}.`;
      await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "VINCULO", descricao: desc } });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "oportunidade_vinculo", registroId: v.id, acao: "CRIAR", valorNovo: v, descricao: desc, ip: meta.ip });
      return v;
    });
  } catch (e) {
    if (ehUnico(e)) throw conflito(`A ${alvo.rotulo} já está vinculada.`);
    throw e;
  }
}

export async function desvincularOportunidade(db: Db, ator: Ator, id: string, vinculoId: string, meta: Meta = {}) {
  exigir(ator, "dados:ver");
  const o = await carregarParaEditar(db, ator, id);
  const v = await db.oportunidadeVinculo.findFirst({
    where: { id: uuid(vinculoId), oportunidadeId: id },
    include: { demanda: { select: { protocolo: true } }, emenda: { select: { codigo: true } }, compromisso: { select: { titulo: true } } },
  });
  if (!v) throw naoEncontrado("Vínculo não encontrado.");
  if (v.demandaId && v.demandaId === o.demandaOrigemId) throw conflito("A demanda de origem não pode ser desvinculada.");
  const rotulo = v.demanda ? `demanda ${v.demanda.protocolo}` : v.emenda ? `emenda ${v.emenda.codigo}` : `compromisso "${v.compromisso?.titulo}"`;
  await db.$transaction(async (tx) => {
    await tx.oportunidadeVinculo.delete({ where: { id: v.id } });
    const desc = `Removeu o vínculo com a ${rotulo}.`;
    await tx.oportunidadeHistorico.create({ data: { oportunidadeId: id, usuarioId: ator.id, tipo: "VINCULO", descricao: desc } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "oportunidade_vinculo", registroId: v.id, acao: "EXCLUIR", valorAnterior: v, descricao: desc, ip: meta.ip });
  });
}

export async function opcoesVinculoOportunidade(db: Db) {
  const [emendas, compromissos] = await Promise.all([
    db.emenda.findMany({ orderBy: { criadoEm: "desc" }, take: 300, select: { id: true, codigo: true, objeto: true } }),
    db.compromisso.findMany({ orderBy: { inicio: "desc" }, take: 300, select: { id: true, titulo: true, inicio: true } }),
  ]);
  return { emendas, compromissos };
}

/** Propostas ligadas a um registro de outro módulo (para as páginas de demanda, emenda e agenda). */
export async function oportunidadesLigadas(db: Db, ator: Ator, alvo: { demandaId?: string; emendaId?: string; compromissoId?: string }) {
  exigir(ator, "dados:ver");
  const itens = await db.oportunidade.findMany({
    where: { OR: [{ vinculos: { some: alvo } }, ...(alvo.demandaId ? [{ demandaOrigemId: alvo.demandaId }] : [])] },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, etapa: true, demandaOrigemId: true },
  });
  return itens.map((o) => ({ ...o, surgiuDaqui: !!alvo.demandaId && o.demandaOrigemId === alvo.demandaId }));
}

/**
 * Dados para pré-preencher uma proposta a partir de uma demanda ou compromisso.
 * Não copia nome nem contato do cidadão; a demanda original não muda.
 */
export async function preencherDeOrigem(db: Db, ator: Ator, origem: OrigemOportunidade) {
  exigir(ator, "dados:criar");
  if (origem.demandaId) {
    const d = UUID.test(origem.demandaId)
      ? await db.demanda.findUnique({ where: { id: origem.demandaId }, include: { tema: true, bairro: true } })
      : null;
    if (!d) throw naoEncontrado("Demanda não encontrada.");
    return {
      rotulo: `demanda ${d.protocolo}`,
      valores: <Record<string, string>>{
        nome: `${d.tema.nome}${d.bairro ? ` – ${d.bairro.nome}` : ""}`.slice(0, 200),
        problema: d.descricao.slice(0, 4000),
        descricaoProblema: `Surgiu da demanda ${d.protocolo} (${d.tema.nome}).\n\n${d.descricao}`.slice(0, 8000),
        bairroIds: d.bairroId ? String(d.bairroId) : "",
        regionalIds: d.bairro ? String(d.bairro.regionalId) : "",
      },
    };
  }
  if (origem.compromissoId) {
    const c = UUID.test(origem.compromissoId) ? await db.compromisso.findUnique({ where: { id: origem.compromissoId }, include: { bairro: true } }) : null;
    if (!c) throw naoEncontrado("Compromisso não encontrado.");
    const partes = [c.pauta && `Pauta: ${c.pauta}`, c.resultado && `Resultado: ${c.resultado}`, c.encaminhamentos && `Encaminhamentos: ${c.encaminhamentos}`].filter(Boolean);
    return {
      rotulo: `compromisso "${c.titulo}"`,
      valores: <Record<string, string>>{
        nome: c.titulo.slice(0, 200),
        descricaoProblema: `Surgiu do compromisso "${c.titulo}" (${c.inicio.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}).${partes.length ? `\n\n${partes.join("\n\n")}` : ""}`.slice(0, 8000),
        bairroIds: c.bairroId ? String(c.bairroId) : "",
        regionalIds: c.bairro ? String(c.bairro.regionalId) : "",
      },
    };
  }
  return null;
}

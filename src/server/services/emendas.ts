import type { Esfera, Prisma, StatusEmenda, TipoDocumentoEmenda, TipoEmenda, TipoLancamento, TipoParticipacao } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import { formatarData, hojeISO } from "@/lib/demandas";
import {
  ROTULO_DOCUMENTO, ROTULO_LANCAMENTO, ROTULO_STATUS_EMENDA, STATUS_ANTES_EMPENHO, STATUS_EMENDA_FINAIS, STATUS_EXIGE_MOTIVO,
  centavos, decimalDe, erroValores, formatarMoeda, resumoFinanceiro, totaisLancamentos, type Valores,
} from "@/lib/emendas";
import { ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO, situacaoMandato } from "@/lib/parlamentares";
import { documentoSchema, emendaSchema, lancamentoSchema, statusEmendaSchema, vinculoEmendaSchema, type EmendaEntrada } from "@/lib/validacao/emenda";
import { rotuloMandato } from "@/server/services/parlamentares";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

const ROTULO_CAMPO: Record<string, string> = {
  numero: "número", ano: "ano", esfera: "esfera", tipo: "tipo", objeto: "objeto", justificativa: "justificativa",
  valorIndicado: "valor indicado", valorAprovado: "valor aprovado", beneficiario: "beneficiário", cnpj: "CNPJ", orgaoId: "órgão",
  secretaria: "secretaria", municipio: "município", bairroId: "bairro", programa: "programa", acaoOrcamentaria: "ação orçamentária",
  prazo: "prazo", responsavelId: "responsável interno", observacoes: "observações",
};

type ComValores = { valorIndicado: Prisma.Decimal; valorAprovado: Prisma.Decimal | null; valorEmpenhado: Prisma.Decimal; valorLiquidado: Prisma.Decimal; valorPago: Prisma.Decimal };

export function valoresDe(e: ComValores): Valores {
  return {
    indicado: centavos(e.valorIndicado),
    aprovado: e.valorAprovado === null ? null : centavos(e.valorAprovado),
    empenhado: centavos(e.valorEmpenhado),
    liquidado: centavos(e.valorLiquidado),
    pago: centavos(e.valorPago),
  };
}

export const podeEditarEmenda = (ator: Ator, e: { responsavelId: string | null; criadoPorId: string | null }) => podeEditarRegistro(ator, e);

export const rotuloEmendaVinculo = (e: { numero: string | null; ano: number }) => (e.numero ? `Nº ${e.numero}/${e.ano}` : `Sem número · ${e.ano}`);

// ---------- consulta ----------

export type FiltrosEmenda = { q?: string; esfera?: string; status?: string; ano?: string; parlamentarId?: string; responsavel?: string; pagina?: number };

function whereEmendas(ator: Ator, f: FiltrosEmenda): Prisma.EmendaWhereInput {
  const e: Prisma.EmendaWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    e.push({ OR: [
      { codigo: { contains: q, mode: "insensitive" } },
      { numero: { contains: q, mode: "insensitive" } },
      { objeto: { contains: q, mode: "insensitive" } },
      { beneficiario: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (f.esfera && ["MUNICIPAL", "ESTADUAL", "FEDERAL"].includes(f.esfera)) e.push({ esfera: f.esfera as Esfera });
  if (f.status === "andamento") e.push({ status: { notIn: STATUS_EMENDA_FINAIS } });
  else if (f.status && f.status in ROTULO_STATUS_EMENDA) e.push({ status: f.status as StatusEmenda });
  if (f.ano && /^\d{4}$/.test(f.ano)) e.push({ ano: Number(f.ano) });
  if (f.parlamentarId && /^[0-9a-f-]{36}$/i.test(f.parlamentarId)) e.push({ mandatos: { some: { mandato: { parlamentarId: f.parlamentarId } } } });
  if (f.responsavel === "eu") e.push({ responsavelId: ator.id });
  else if (f.responsavel === "sem") e.push({ responsavelId: null });
  return e.length ? { AND: e } : {};
}

export async function listarEmendas(db: Db, ator: Ator, f: FiltrosEmenda = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereEmendas(ator, f);
  const [itens, total, soma] = await Promise.all([
    db.emenda.findMany({
      where,
      orderBy: [{ ano: "desc" }, { codigo: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        orgao: { select: { sigla: true, nome: true } },
        responsavel: { select: { nome: true } },
        mandatos: { where: { tipo: "AUTOR" }, include: { mandato: { select: { parlamentar: { select: { id: true, nome: true } } } } } },
      },
    }),
    db.emenda.count({ where }),
    db.emenda.aggregate({ where, _sum: { valorIndicado: true, valorAprovado: true, valorEmpenhado: true, valorLiquidado: true, valorPago: true } }),
  ]);
  const s = soma._sum;
  const totais = {
    indicado: centavos(s.valorIndicado), aprovado: centavos(s.valorAprovado), empenhado: centavos(s.valorEmpenhado),
    liquidado: centavos(s.valorLiquidado), pago: centavos(s.valorPago),
  };
  return {
    itens: itens.map((e) => ({ ...e, valores: valoresDe(e), autor: e.mandatos[0]?.mandato.parlamentar ?? null })),
    total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)),
    totais: { ...totais, saldo: totais.empenhado - totais.pago },
  };
}

export async function anosEmendas(db: Db) {
  const r = await db.emenda.findMany({ distinct: ["ano"], orderBy: { ano: "desc" }, select: { ano: true } });
  return r.map((x) => x.ano);
}

export async function obterEmenda(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const e = await db.emenda.findUnique({
    where: { id },
    include: {
      orgao: true,
      bairro: { include: { regional: true } },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      historico: { orderBy: { data: "desc" }, include: { usuario: { select: { nome: true } } } },
      lancamentos: { orderBy: [{ data: "asc" }, { criadoEm: "asc" }], include: { usuario: { select: { nome: true } } } },
      mandatos: {
        orderBy: { criadoEm: "asc" },
        include: { mandato: { include: { parlamentar: { select: { id: true, nome: true, partido: true, proprio: true } } } }, usuario: { select: { nome: true } } },
      },
      documentos: { orderBy: { criadoEm: "desc" }, include: { usuario: { select: { nome: true } } } },
    },
  });
  if (!e) throw naoEncontrado("Emenda não encontrada.");
  const valores = valoresDe(e);
  return {
    ...e,
    valores,
    resumo: resumoFinanceiro(valores),
    autor: e.mandatos.find((m) => m.tipo === "AUTOR") ?? null,
    podeEditar: podeEditarEmenda(ator, e),
  };
}

/** Opções dos formulários. Mandatos: todos, inclusive o próprio (autoria só por escolha explícita). */
export async function opcoesEmenda(db: Db) {
  const [orgaos, regionais, responsaveis, mandatos] = await Promise.all([
    db.orgao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, sigla: true } }),
    db.regional.findMany({ orderBy: { nome: "asc" }, include: { bairros: { orderBy: { nome: "asc" }, select: { id: true, nome: true } } } }),
    db.usuario.findMany({ where: { ativo: true, perfil: { not: "CONSULTA" } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.mandato.findMany({
      where: { parlamentar: { ativo: true } },
      orderBy: [{ parlamentar: { proprio: "desc" } }, { parlamentar: { nome: "asc" } }, { dataInicio: "desc" }],
      select: { id: true, legislatura: true, cargo: true, esfera: true, dataInicio: true, dataFim: true, partido: true, parlamentar: { select: { nome: true, partido: true, proprio: true } } },
    }),
  ]);
  return {
    orgaos, regionais, responsaveis,
    mandatos: mandatos.map((m) => {
      const partido = m.partido ?? m.parlamentar.partido;
      const sit = situacaoMandato(m.dataInicio, m.dataFim) === "VIGENTE" ? "" : " — encerrado/futuro";
      return {
        id: m.id,
        rotulo: `${m.parlamentar.nome}${partido ? ` (${partido})` : ""}${m.parlamentar.proprio ? " [mandato próprio]" : ""} — ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}${sit}`,
      };
    }),
  };
}
export type OpcoesEmenda = Awaited<ReturnType<typeof opcoesEmenda>>;

// ---------- cadastro ----------

async function validarReferencias(db: Db | Tx, d: { orgaoId: number | null; bairroId: number | null; responsavelId: string | null }) {
  if (d.orgaoId && !(await db.orgao.findFirst({ where: { id: d.orgaoId, ativo: true } }))) throw validacao("Órgão inválido.");
  if (d.bairroId && !(await db.bairro.findUnique({ where: { id: d.bairroId } }))) throw validacao("Bairro inválido.");
  if (d.responsavelId) {
    const u = await db.usuario.findUnique({ where: { id: d.responsavelId } });
    if (!u || !u.ativo || u.perfil === "CONSULTA") throw validacao("Responsável interno precisa ser um usuário ativo que não seja de consulta.");
  }
}

function normalizar(entrada: EmendaEntrada) {
  const r = emendaSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const d = r.data;
  return {
    centavos: { indicado: d.valorIndicado!, aprovado: d.valorAprovado },
    dados: {
      numero: d.numero, ano: d.ano, esfera: d.esfera as Esfera, tipo: d.tipo as TipoEmenda, objeto: d.objeto, justificativa: d.justificativa,
      valorIndicado: decimalDe(d.valorIndicado!), valorAprovado: d.valorAprovado === null ? null : decimalDe(d.valorAprovado),
      beneficiario: d.beneficiario, cnpj: d.cnpj, orgaoId: d.orgaoId, secretaria: d.secretaria, municipio: d.municipio, bairroId: d.bairroId,
      programa: d.programa, acaoOrcamentaria: d.acaoOrcamentaria, prazo: d.prazo, responsavelId: d.responsavelId, observacoes: d.observacoes,
    },
  };
}

const numeroRepetido = (d: { esfera: string; numero: string | null; ano: number }) =>
  conflito(`Já existe emenda ${ROTULO_ESFERA[d.esfera as Esfera].toLowerCase()} nº ${d.numero} de ${d.ano}.`);

async function checarNumero(db: Db, d: { esfera: Esfera; numero: string | null; ano: number }, ignorarId?: string) {
  if (!d.numero) return;
  const outra = await db.emenda.findFirst({ where: { esfera: d.esfera, ano: d.ano, numero: d.numero, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (outra) throw numeroRepetido(d);
}

async function proximoCodigo(tx: Tx) {
  const ano = Number(hojeISO().slice(0, 4));
  const [{ ultimo }] = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO emenda_seq (ano, ultimo) VALUES (${ano}, 1)
    ON CONFLICT (ano) DO UPDATE SET ultimo = emenda_seq.ultimo + 1
    RETURNING ultimo`;
  return `EME-${ano}-${String(ultimo).padStart(5, "0")}`;
}

export async function criarEmenda(db: Db, ator: Ator, entrada: EmendaEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const { dados, centavos: c } = normalizar(entrada);
  const erro = erroValores({ indicado: c.indicado, aprovado: c.aprovado, empenhado: 0, liquidado: 0, pago: 0 });
  if (erro) throw validacao(erro);
  await validarReferencias(db, dados);
  await checarNumero(db, dados);
  try {
    return await db.$transaction(async (tx) => {
      const codigo = await proximoCodigo(tx);
      const e = await tx.emenda.create({ data: { ...dados, codigo, criadoPorId: ator.id } });
      await tx.emendaHistorico.create({ data: { emendaId: e.id, usuarioId: ator.id, tipo: "CRIACAO", statusNovo: e.status, descricao: `Emenda cadastrada (${ROTULO_ESFERA[e.esfera].toLowerCase()}, ${formatarMoeda(c.indicado)} indicados).` } });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda", registroId: e.id, acao: "CRIAR", valorNovo: e, ip: meta.ip });
      return e;
    });
  } catch (e) {
    if (ehUnico(e)) throw numeroRepetido(dados);
    throw e;
  }
}

async function carregarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const e = await db.emenda.findUnique({ where: { id } });
  if (!e) throw naoEncontrado("Emenda não encontrada.");
  if (!podeEditarEmenda(ator, e)) throw proibir("Você só pode alterar emendas sob sua responsabilidade ou cadastradas por você.");
  return e;
}

const comparavel = (v: unknown) => (v && typeof v === "object" && "toFixed" in v ? (v as Prisma.Decimal).toFixed(2) : v);

export async function atualizarEmenda(db: Db, ator: Ator, id: string, entrada: EmendaEntrada, meta: Meta = {}) {
  const atual = await carregarParaEditar(db, ator, id);
  const { dados, centavos: c } = normalizar(entrada);
  const v = valoresDe(atual);
  const erro = erroValores({ ...v, indicado: c.indicado, aprovado: c.aprovado });
  if (erro) throw validacao(`${erro} Já há ${formatarMoeda(v.empenhado)} empenhados.`);
  await validarReferencias(db, dados);
  await checarNumero(db, dados, id);
  if (dados.esfera !== atual.esfera) {
    const autoria = await db.emendaMandato.findFirst({ where: { emendaId: id, tipo: { in: ["AUTOR", "COAUTOR"] }, mandato: { esfera: { not: dados.esfera } } } });
    if (autoria) throw validacao("Há autor ou coautor de outra esfera vinculado. Remova o vínculo antes de mudar a esfera.");
  }
  const antes = Object.fromEntries(Object.keys(dados).map((k) => [k, comparavel((atual as Record<string, unknown>)[k])]));
  const d = diferenca(antes, dados as Record<string, unknown>);
  if (!d.mudou) return atual;
  try {
    return await db.$transaction(async (tx) => {
      const e = await tx.emenda.update({ where: { id }, data: dados });
      const campos = Object.keys(d.novo).filter((k) => k !== "responsavelId").map((k) => ROTULO_CAMPO[k] ?? k);
      if (campos.length) await tx.emendaHistorico.create({ data: { emendaId: id, usuarioId: ator.id, tipo: "EDICAO", descricao: `Alterou: ${campos.join(", ")}.` } });
      if ("responsavelId" in d.novo) {
        const r = dados.responsavelId ? await tx.usuario.findUnique({ where: { id: dados.responsavelId }, select: { nome: true } }) : null;
        await tx.emendaHistorico.create({ data: { emendaId: id, usuarioId: ator.id, tipo: "RESPONSAVEL", descricao: r ? `Responsável interno: ${r.nome}.` : "Responsável interno removido." } });
      }
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda", registroId: id, acao: "EDITAR", valorAnterior: d.anterior, valorNovo: d.novo, ip: meta.ip });
      return e;
    });
  } catch (e) {
    if (ehUnico(e)) throw numeroRepetido(dados);
    throw e;
  }
}

/** Status que exigem execução registrada. */
const EXIGE_VALOR: Partial<Record<StatusEmenda, keyof Valores>> = { EMPENHADA: "empenhado", LIQUIDADA: "liquidado", PAGA: "pago" };

export async function alterarStatusEmenda(db: Db, ator: Ator, id: string, entrada: { status: string; comentario?: string | null }, meta: Meta = {}) {
  const atual = await carregarParaEditar(db, ator, id);
  const r = statusEmendaSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const status = r.data.status as StatusEmenda;
  if (status === atual.status) throw validacao("A emenda já está com esse status.");
  if (STATUS_EXIGE_MOTIVO.includes(status) && !r.data.comentario) throw validacao(`Explique o motivo para marcar como "${ROTULO_STATUS_EMENDA[status]}".`);
  const campo = EXIGE_VALOR[status];
  if (campo && !valoresDe(atual)[campo]) throw validacao(`Registre o lançamento de ${campo === "empenhado" ? "empenho" : campo === "liquidado" ? "liquidação" : "pagamento"} antes de marcar como "${ROTULO_STATUS_EMENDA[status]}".`);
  return db.$transaction(async (tx) => {
    const e = await tx.emenda.update({ where: { id }, data: { status } });
    await tx.emendaHistorico.create({
      data: {
        emendaId: id, usuarioId: ator.id, tipo: "STATUS", statusAnterior: atual.status, statusNovo: status,
        descricao: `${ROTULO_STATUS_EMENDA[atual.status]} → ${ROTULO_STATUS_EMENDA[status]}${r.data.comentario ? `: ${r.data.comentario}` : ""}`,
      },
    });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda", registroId: id, acao: "EDITAR", valorAnterior: { status: atual.status }, valorNovo: { status }, ip: meta.ip });
    return e;
  });
}

export async function comentarEmenda(db: Db, ator: Ator, id: string, texto: string) {
  await carregarParaEditar(db, ator, id);
  const t = texto.trim();
  if (t.length < 2) throw validacao("Escreva o comentário.");
  if (t.length > 2000) throw validacao("Máximo de 2000 caracteres.");
  return db.emendaHistorico.create({ data: { emendaId: id, usuarioId: ator.id, tipo: "COMENTARIO", descricao: t } });
}

// ---------- execução financeira ----------

/** Trava a emenda, soma os lançamentos e grava os totais. Lança erro (e desfaz) se os valores não fecharem. */
async function recalcular(tx: Tx, emendaId: string) {
  await tx.$queryRaw`SELECT id FROM emenda WHERE id = ${emendaId}::uuid FOR UPDATE`;
  const e = await tx.emenda.findUniqueOrThrow({ where: { id: emendaId } });
  const ls = await tx.emendaLancamento.findMany({ where: { emendaId }, select: { tipo: true, valor: true } });
  const t = totaisLancamentos(ls);
  const v = { ...valoresDe(e), ...t };
  const erro = erroValores(v);
  if (erro) throw validacao(erro);
  return tx.emenda.update({
    where: { id: emendaId },
    data: { valorEmpenhado: decimalDe(t.empenhado), valorLiquidado: decimalDe(t.liquidado), valorPago: decimalDe(t.pago) },
  });
}

export async function registrarLancamento(db: Db, ator: Ator, emendaId: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  const e = await carregarParaEditar(db, ator, emendaId);
  if (e.status === "CANCELADA") throw validacao("Emenda cancelada não recebe lançamentos.");
  const r = lancamentoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const data = r.data.data!;
  if (data.toISOString().slice(0, 10) > hojeISO()) throw validacao("A data do lançamento não pode estar no futuro.");
  const tipo = r.data.tipo as TipoLancamento;
  return db.$transaction(async (tx) => {
    const l = await tx.emendaLancamento.create({
      data: { emendaId, tipo, valor: decimalDe(r.data.valor!), data, documento: r.data.documento, observacoes: r.data.observacoes, usuarioId: ator.id },
    });
    const depois = await recalcular(tx, emendaId);
    await tx.emendaHistorico.create({
      data: {
        emendaId, usuarioId: ator.id, tipo: "EXECUCAO",
        descricao: `${ROTULO_LANCAMENTO[tipo]} de ${formatarMoeda(r.data.valor!)} em ${formatarData(data)}${r.data.documento ? ` (${r.data.documento})` : ""}.`,
      },
    });
    if (tipo === "EMPENHO" && STATUS_ANTES_EMPENHO.includes(depois.status)) {
      await tx.emenda.update({ where: { id: emendaId }, data: { status: "EMPENHADA" } });
      await tx.emendaHistorico.create({
        data: { emendaId, usuarioId: ator.id, tipo: "STATUS", statusAnterior: depois.status, statusNovo: "EMPENHADA", descricao: `${ROTULO_STATUS_EMENDA[depois.status]} → Empenhada (primeiro empenho).` },
      });
    }
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_lancamento", registroId: l.id, acao: "CRIAR", valorNovo: l, ip: meta.ip });
    return l;
  });
}

export async function excluirLancamento(db: Db, ator: Ator, lancamentoId: string, meta: Meta = {}) {
  const l = await db.emendaLancamento.findUnique({ where: { id: lancamentoId } });
  if (!l) throw naoEncontrado("Lançamento não encontrado.");
  await carregarParaEditar(db, ator, l.emendaId);
  await db.$transaction(async (tx) => {
    await tx.emendaLancamento.delete({ where: { id: l.id } });
    try {
      await recalcular(tx, l.emendaId);
    } catch (e) {
      throw validacao(`Não dá para excluir: ${(e as Error).message} Exclua antes os lançamentos posteriores.`);
    }
    await tx.emendaHistorico.create({
      data: { emendaId: l.emendaId, usuarioId: ator.id, tipo: "EXECUCAO", descricao: `Excluiu ${ROTULO_LANCAMENTO[l.tipo].toLowerCase()} de ${formatarMoeda(centavos(l.valor))} (${formatarData(l.data)}).` },
    });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_lancamento", registroId: l.id, acao: "EXCLUIR", valorAnterior: l, ip: meta.ip });
  });
  return l.emendaId;
}

// ---------- emenda ↔ mandato ----------

const descreverVinculo = (tipo: TipoParticipacao, m: { cargo: keyof typeof ROTULO_CARGO; legislatura: string | null; parlamentar: { nome: string } }) =>
  `${ROTULO_PARTICIPACAO[tipo]}: ${m.parlamentar.nome} (${ROTULO_CARGO[m.cargo]}${m.legislatura ? `, ${m.legislatura}` : ""})`;

export async function vincularMandatoEmenda(db: Db, ator: Ator, emendaId: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  const e = await carregarParaEditar(db, ator, emendaId);
  const r = vinculoEmendaSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const tipo = r.data.tipo as TipoParticipacao;
  const m = await db.mandato.findUnique({ where: { id: r.data.mandatoId }, include: { parlamentar: true } });
  if (!m) throw validacao("Mandato inválido.");
  if (tipo === "AUTOR" || tipo === "COAUTOR") {
    if (m.esfera !== e.esfera) throw validacao(`Autor e coautor precisam ter mandato ${ROTULO_ESFERA[e.esfera].toLowerCase()}, a mesma esfera da emenda.`);
    const anoInicio = m.dataInicio.getUTCFullYear();
    const anoFim = m.dataFim?.getUTCFullYear() ?? Infinity;
    if (e.ano < anoInicio || e.ano > anoFim) throw validacao(`Esse mandato não estava em exercício em ${e.ano}.`);
    const outro = tipo === "AUTOR" ? "COAUTOR" : "AUTOR";
    if (await db.emendaMandato.findFirst({ where: { emendaId, mandatoId: m.id, tipo: outro } })) throw validacao("O mesmo mandato não pode ser autor e coautor da emenda.");
  }
  const autorRepetido = async () => {
    const a = await db.emendaMandato.findFirst({ where: { emendaId, tipo: "AUTOR" }, include: { mandato: { include: { parlamentar: true } } } });
    return a ? conflito(`A emenda já tem autor: ${a.mandato.parlamentar.nome}. Remova esse vínculo antes de trocar.`) : null;
  };
  if (tipo === "AUTOR") {
    const erro = await autorRepetido();
    if (erro) throw erro;
  }
  const repetido = conflito("Esse mandato já está vinculado à emenda com essa participação.");
  if (await db.emendaMandato.findUnique({ where: { emendaId_mandatoId_tipo: { emendaId, mandatoId: m.id, tipo } } })) throw repetido;
  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.emendaMandato.create({
        data: {
          emendaId, mandatoId: m.id, tipo, responsabilidade: r.data.responsabilidade, dataInicio: r.data.dataInicio, dataFim: r.data.dataFim,
          observacoes: r.data.observacoes, usuarioId: ator.id,
        },
      });
      await tx.emendaHistorico.create({
        data: { emendaId, usuarioId: ator.id, tipo: "MANDATO", descricao: `${descreverVinculo(tipo, m)}${r.data.responsabilidade ? ` — ${r.data.responsabilidade}` : ""}` },
      });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_mandato", registroId: v.id, acao: "CRIAR", valorNovo: v, ip: meta.ip });
      return v;
    });
  } catch (err) {
    if (ehUnico(err)) throw (tipo === "AUTOR" ? await autorRepetido() : null) ?? repetido;
    throw err;
  }
}

export async function desvincularMandatoEmenda(db: Db, ator: Ator, vinculoId: string, meta: Meta = {}) {
  const v = await db.emendaMandato.findUnique({ where: { id: vinculoId }, include: { mandato: { include: { parlamentar: true } } } });
  if (!v) throw naoEncontrado("Vínculo não encontrado.");
  await carregarParaEditar(db, ator, v.emendaId);
  const { mandato, ...dados } = v;
  await db.$transaction(async (tx) => {
    await tx.emendaMandato.delete({ where: { id: v.id } });
    await tx.emendaHistorico.create({ data: { emendaId: v.emendaId, usuarioId: ator.id, tipo: "MANDATO", descricao: `Removeu vínculo — ${descreverVinculo(v.tipo, mandato)}` } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_mandato", registroId: v.id, acao: "EXCLUIR", valorAnterior: dados, ip: meta.ip });
  });
  return v.emendaId;
}

// ---------- documentos (referências) ----------

export async function adicionarDocumento(db: Db, ator: Ator, emendaId: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  await carregarParaEditar(db, ator, emendaId);
  const r = documentoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const tipo = r.data.tipo as TipoDocumentoEmenda;
  return db.$transaction(async (tx) => {
    const d = await tx.emendaDocumento.create({ data: { ...r.data, tipo, emendaId, usuarioId: ator.id } });
    await tx.emendaHistorico.create({ data: { emendaId, usuarioId: ator.id, tipo: "DOCUMENTO", descricao: `${ROTULO_DOCUMENTO[tipo]}: ${d.descricao}${d.numero ? ` (nº ${d.numero})` : ""}.` } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_documento", registroId: d.id, acao: "CRIAR", valorNovo: d, ip: meta.ip });
    return d;
  });
}

export async function removerDocumento(db: Db, ator: Ator, documentoId: string, meta: Meta = {}) {
  const d = await db.emendaDocumento.findUnique({ where: { id: documentoId } });
  if (!d) throw naoEncontrado("Documento não encontrado.");
  await carregarParaEditar(db, ator, d.emendaId);
  await db.$transaction(async (tx) => {
    await tx.emendaDocumento.delete({ where: { id: d.id } });
    await tx.emendaHistorico.create({ data: { emendaId: d.emendaId, usuarioId: ator.id, tipo: "DOCUMENTO", descricao: `Removeu ${ROTULO_DOCUMENTO[d.tipo].toLowerCase()}: ${d.descricao}.` } });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "emenda_documento", registroId: d.id, acao: "EXCLUIR", valorAnterior: d, ip: meta.ip });
  });
  return d.emendaId;
}

// ---------- rede de mandatos ----------

export type ItemRede = {
  id: string; codigo: string; numero: string | null; ano: number; esfera: Esfera; status: StatusEmenda; objeto: string;
  valor: number; pago: number; orgao: string | null; beneficiario: string | null;
  tiposProprio: TipoParticipacao[]; tiposParceiro: TipoParticipacao[];
};

/** Mandato próprio → parlamentar parceiro → emenda → órgão → beneficiário. Só emendas com vínculo explícito do mandato próprio. */
export async function redeMandatos(db: Db, ator: Ator, f: { esfera?: string; status?: string } = {}) {
  exigir(ator, "dados:ver");
  const proprio = await db.parlamentar.findFirst({ where: { proprio: true }, select: { id: true, nome: true, cargo: true, partido: true } });
  const vazio = { proprio, grupos: [], semParceiro: [] as ItemRede[], totais: { emendas: 0, valor: 0, pago: 0, porEsfera: {} as Partial<Record<Esfera, { emendas: number; valor: number }>> } };
  if (!proprio) return vazio;
  const where: Prisma.EmendaWhereInput = { AND: [whereEmendas(ator, { esfera: f.esfera, status: f.status }), { mandatos: { some: { mandato: { parlamentar: { proprio: true } } } } }] };
  const emendas = await db.emenda.findMany({
    where,
    orderBy: [{ ano: "desc" }, { codigo: "asc" }],
    include: {
      orgao: { select: { sigla: true, nome: true } },
      mandatos: { include: { mandato: { select: { parlamentar: { select: { id: true, nome: true, cargo: true, partido: true, proprio: true } } } } } },
    },
  });
  type Grupo = { parlamentar: { id: string; nome: string; cargo: keyof typeof ROTULO_CARGO; partido: string | null }; emendas: ItemRede[]; valor: number; pago: number; tipos: Set<TipoParticipacao> };
  const grupos = new Map<string, Grupo>();
  const semParceiro: ItemRede[] = [];
  const totais = { emendas: emendas.length, valor: 0, pago: 0, porEsfera: {} as Partial<Record<Esfera, { emendas: number; valor: number }>> };
  for (const e of emendas) {
    const v = valoresDe(e);
    const valor = v.aprovado ?? v.indicado;
    totais.valor += valor;
    totais.pago += v.pago;
    const pe = (totais.porEsfera[e.esfera] ??= { emendas: 0, valor: 0 });
    pe.emendas += 1;
    pe.valor += valor;
    const base = {
      id: e.id, codigo: e.codigo, numero: e.numero, ano: e.ano, esfera: e.esfera, status: e.status, objeto: e.objeto, valor, pago: v.pago,
      orgao: e.orgao ? e.orgao.sigla ?? e.orgao.nome : e.secretaria, beneficiario: e.beneficiario,
      tiposProprio: e.mandatos.filter((m) => m.mandato.parlamentar.proprio).map((m) => m.tipo),
    };
    const parceiros = new Map<string, { p: Grupo["parlamentar"]; tipos: TipoParticipacao[] }>();
    for (const m of e.mandatos) {
      const p = m.mandato.parlamentar;
      if (p.proprio) continue;
      const atual = parceiros.get(p.id) ?? { p: { id: p.id, nome: p.nome, cargo: p.cargo, partido: p.partido }, tipos: [] };
      atual.tipos.push(m.tipo);
      parceiros.set(p.id, atual);
    }
    if (parceiros.size === 0) semParceiro.push({ ...base, tiposParceiro: [] });
    for (const [pid, { p, tipos }] of parceiros) {
      const g = grupos.get(pid) ?? { parlamentar: p, emendas: [], valor: 0, pago: 0, tipos: new Set() };
      g.emendas.push({ ...base, tiposParceiro: tipos });
      g.valor += valor;
      g.pago += v.pago;
      tipos.forEach((t) => g.tipos.add(t));
      grupos.set(pid, g);
    }
  }
  return {
    proprio,
    grupos: [...grupos.values()].sort((a, b) => b.valor - a.valor).map((g) => ({ ...g, tipos: [...g.tipos] })),
    semParceiro,
    totais,
  };
}

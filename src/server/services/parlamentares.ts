import type { CargoParlamentar, Esfera, Prisma, TipoParticipacao } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, pode, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import { formatarData } from "@/lib/demandas";
import { ROTULO_CARGO, ROTULO_PARTICIPACAO, esferaDoCargo, periodosSobrepostos, situacaoMandato } from "@/lib/parlamentares";
import { mandatoSchema, parlamentarSchema, vinculoSchema, type MandatoEntrada, type ParlamentarEntrada } from "@/lib/validacao/parlamentar";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

const ROTULO_CAMPO: Record<string, string> = {
  nome: "nome", cargo: "cargo", esfera: "esfera", partido: "partido", municipio: "município", uf: "UF", telefone: "telefone",
  email: "e-mail", observacoes: "observações", ativo: "situação", proprio: "mandato próprio",
  legislatura: "legislatura", descricao: "descrição", dataInicio: "início", dataFim: "fim",
};
const listaCampos = (novo: Record<string, unknown>) => Object.keys(novo).map((k) => ROTULO_CAMPO[k] ?? k).join(", ");

export function rotuloMandato(m: { legislatura?: string | null; dataInicio: Date; dataFim: Date | null }) {
  const periodo = `${formatarData(m.dataInicio)} – ${m.dataFim ? formatarData(m.dataFim) : "em aberto"}`;
  return m.legislatura ? `${m.legislatura} (${periodo})` : periodo;
}

/** Quem cadastrou (assessor) ou quem edita tudo. */
export const podeEditarParlamentar = (ator: Ator, p: { criadoPorId: string | null }) => podeEditarRegistro(ator, { criadoPorId: p.criadoPorId });

// ---------- consulta ----------

export type FiltrosParlamentar = { q?: string; cargo?: string; esfera?: string; situacao?: string; pagina?: number };

function whereParlamentares(f: FiltrosParlamentar): Prisma.ParlamentarWhereInput {
  const e: Prisma.ParlamentarWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    e.push({ OR: [
      { nome: { contains: q, mode: "insensitive" } },
      { partido: { contains: q, mode: "insensitive" } },
      { municipio: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (f.cargo && f.cargo in ROTULO_CARGO) e.push({ cargo: f.cargo as CargoParlamentar });
  if (f.esfera && ["MUNICIPAL", "ESTADUAL", "FEDERAL"].includes(f.esfera)) e.push({ esfera: f.esfera as Esfera });
  if (f.situacao === "inativos") e.push({ ativo: false });
  else if (f.situacao !== "todos") e.push({ ativo: true });
  return e.length ? { AND: e } : {};
}

export async function listarParlamentares(db: Db, ator: Ator, f: FiltrosParlamentar = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereParlamentares(f);
  const [itens, total] = await Promise.all([
    db.parlamentar.findMany({
      where,
      orderBy: [{ proprio: "desc" }, { nome: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true, nome: true, cargo: true, partido: true, esfera: true, municipio: true, uf: true, proprio: true, ativo: true,
        mandatos: {
          orderBy: { dataInicio: "desc" },
          select: { id: true, legislatura: true, dataInicio: true, dataFim: true, cargo: true, _count: { select: { demandas: true } } },
        },
      },
    }),
    db.parlamentar.count({ where }),
  ]);
  return {
    itens: itens.map((p) => ({
      ...p,
      vigente: p.mandatos.find((m) => situacaoMandato(m.dataInicio, m.dataFim) === "VIGENTE") ?? null,
      vinculos: p.mandatos.reduce((s, m) => s + m._count.demandas, 0),
    })),
    total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

export async function obterParlamentar(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const p = await db.parlamentar.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { nome: true } },
      mandatos: { orderBy: { dataInicio: "desc" }, include: { _count: { select: { demandas: true } } } },
    },
  });
  if (!p) throw naoEncontrado("Parlamentar não encontrado.");
  const idsMandatos = p.mandatos.map((m) => m.id);
  const [vinculos, historico] = await Promise.all([
    db.demandaMandato.findMany({
      where: { mandatoId: { in: idsMandatos } },
      orderBy: { criadoEm: "desc" },
      take: 100,
      include: {
        demanda: { select: { id: true, protocolo: true, status: true, descricao: true, tema: { select: { nome: true } } } },
        mandato: { select: { legislatura: true, dataInicio: true, dataFim: true, cargo: true } },
      },
    }),
    db.auditLog.findMany({
      where: { OR: [{ entidade: "parlamentar", registroId: id }, { entidade: "mandato", registroId: { in: idsMandatos } }] },
      orderBy: { data: "desc" },
      take: 50,
      include: { usuario: { select: { nome: true } } },
    }),
  ]);
  return { ...p, vinculos, historico, podeEditar: podeEditarParlamentar(ator, p) };
}

/** Mandatos de parceiros (nunca o próprio) para vincular a demandas. */
export async function opcoesMandatosParceiros(db: Db) {
  const ms = await db.mandato.findMany({
    where: { parlamentar: { proprio: false, ativo: true } },
    orderBy: [{ parlamentar: { nome: "asc" } }, { dataInicio: "desc" }],
    select: { id: true, legislatura: true, cargo: true, dataInicio: true, dataFim: true, partido: true, parlamentar: { select: { nome: true, partido: true } } },
  });
  return ms.map((m) => {
    const partido = m.partido ?? m.parlamentar.partido;
    const sit = situacaoMandato(m.dataInicio, m.dataFim);
    return {
      id: m.id,
      rotulo: `${m.parlamentar.nome}${partido ? ` (${partido})` : ""} — ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}${sit === "ENCERRADO" ? " · encerrado" : ""}`,
    };
  });
}

// ---------- parlamentares ----------

async function checarNomeEProprio(db: Db | Tx, d: { nome: string; proprio: boolean }, ignorarId?: string) {
  const mesmo = await db.parlamentar.findFirst({ where: { nome: { equals: d.nome, mode: "insensitive" }, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (mesmo) throw conflito("Já existe um parlamentar com esse nome.");
  if (d.proprio) {
    const outro = await db.parlamentar.findFirst({ where: { proprio: true, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
    if (outro) throw conflito(`O mandato próprio já está definido (${outro.nome}). Desmarque lá antes.`);
  }
}

function normalizarParlamentar(entrada: ParlamentarEntrada) {
  const r = parlamentarSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const cargo = r.data.cargo as CargoParlamentar;
  return { ...r.data, cargo, esfera: esferaDoCargo(cargo, r.data.esfera as Esfera | null) };
}

export async function criarParlamentar(db: Db, ator: Ator, entrada: ParlamentarEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const dados = normalizarParlamentar(entrada);
  if (dados.proprio && !pode(ator, "cadastros_base:gerenciar")) throw proibir("Só administração e coordenação definem o mandato próprio.");
  await checarNomeEProprio(db, dados);
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.parlamentar.create({ data: { ...dados, criadoPorId: ator.id } });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "parlamentar", registroId: p.id, acao: "CRIAR", valorNovo: p,
        descricao: `Parlamentar cadastrado: ${p.nome} (${ROTULO_CARGO[p.cargo]}).`, ip: meta.ip,
      });
      return p;
    });
  } catch (e) {
    if (ehUnico(e)) throw conflito("O mandato próprio já está definido para outro parlamentar.");
    throw e;
  }
}

async function carregarParlamentarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const p = await db.parlamentar.findUnique({ where: { id } });
  if (!p) throw naoEncontrado("Parlamentar não encontrado.");
  if (!podeEditarParlamentar(ator, p)) throw proibir("Você só pode editar parlamentares que você cadastrou.");
  return p;
}

export async function atualizarParlamentar(db: Db, ator: Ator, id: string, entrada: ParlamentarEntrada, meta: Meta = {}) {
  const dados = normalizarParlamentar(entrada);
  const atual = await carregarParlamentarParaEditar(db, ator, id);
  if (dados.proprio !== atual.proprio && !pode(ator, "cadastros_base:gerenciar")) {
    throw proibir("Só administração e coordenação definem o mandato próprio.");
  }
  await checarNomeEProprio(db, dados, id);
  const d = diferenca(atual as unknown as Record<string, unknown>, dados);
  if (!d.mudou) return atual;
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.parlamentar.update({ where: { id }, data: dados });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "parlamentar", registroId: id, acao: "EDITAR",
        valorAnterior: d.anterior, valorNovo: d.novo, descricao: `Alterou: ${listaCampos(d.novo)}.`, ip: meta.ip,
      });
      return p;
    });
  } catch (e) {
    if (ehUnico(e)) throw conflito("O mandato próprio já está definido para outro parlamentar.");
    throw e;
  }
}

// ---------- mandatos ----------

async function checarSobreposicao(db: Db | Tx, parlamentarId: string, periodo: { inicio: Date; fim: Date | null }, ignorarId?: string) {
  const outros = await db.mandato.findMany({ where: { parlamentarId, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  const choque = outros.find((m) => periodosSobrepostos(periodo, { inicio: m.dataInicio, fim: m.dataFim }));
  if (choque) throw validacao(`O período se sobrepõe a outro mandato da mesma pessoa: ${rotuloMandato(choque)}.`);
}

function normalizarMandato(entrada: MandatoEntrada, parlamentar: { partido: string | null; municipio: string | null; uf: string | null }) {
  const r = mandatoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const cargo = r.data.cargo as CargoParlamentar;
  return {
    ...r.data,
    cargo,
    esfera: esferaDoCargo(cargo, r.data.esfera as Esfera | null),
    dataInicio: r.data.dataInicio!,
    partido: r.data.partido ?? parlamentar.partido,
    municipio: r.data.municipio ?? parlamentar.municipio,
    uf: r.data.uf ?? parlamentar.uf,
  };
}

export async function criarMandato(db: Db, ator: Ator, parlamentarId: string, entrada: MandatoEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const p = await carregarParlamentarParaEditar(db, ator, parlamentarId);
  const dados = normalizarMandato(entrada, p);
  await checarSobreposicao(db, parlamentarId, { inicio: dados.dataInicio, fim: dados.dataFim });
  return db.$transaction(async (tx) => {
    const m = await tx.mandato.create({ data: { ...dados, parlamentarId, criadoPorId: ator.id } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "mandato", registroId: m.id, acao: "CRIAR", valorNovo: m,
      descricao: `Mandato cadastrado: ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}.`, ip: meta.ip,
    });
    return m;
  });
}

async function carregarMandatoParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const m = await db.mandato.findUnique({ where: { id }, include: { parlamentar: true, _count: { select: { demandas: true } } } });
  if (!m) throw naoEncontrado("Mandato não encontrado.");
  if (!podeEditarParlamentar(ator, m.parlamentar)) throw proibir("Você só pode editar parlamentares que você cadastrou.");
  return m;
}

export async function atualizarMandato(db: Db, ator: Ator, id: string, entrada: MandatoEntrada, meta: Meta = {}) {
  const atual = await carregarMandatoParaEditar(db, ator, id);
  const dados = normalizarMandato(entrada, atual.parlamentar);
  await checarSobreposicao(db, atual.parlamentarId, { inicio: dados.dataInicio, fim: dados.dataFim }, id);
  const { parlamentar: _p, _count: _c, ...antes } = atual;
  const d = diferenca(antes as unknown as Record<string, unknown>, dados);
  if (!d.mudou) return atual;
  return db.$transaction(async (tx) => {
    const m = await tx.mandato.update({ where: { id }, data: dados });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "mandato", registroId: id, acao: "EDITAR", valorAnterior: d.anterior, valorNovo: d.novo,
      descricao: `Mandato ${rotuloMandato(m)} — alterou: ${listaCampos(d.novo)}.`, ip: meta.ip,
    });
    return m;
  });
}

export async function excluirMandato(db: Db, ator: Ator, id: string, meta: Meta = {}) {
  const m = await carregarMandatoParaEditar(db, ator, id);
  if (m._count.demandas > 0) throw validacao("Este mandato tem demandas vinculadas. Remova os vínculos antes de excluir.");
  const { parlamentar: _p, _count: _c, ...dados } = m;
  await db.$transaction(async (tx) => {
    await tx.mandato.delete({ where: { id } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "mandato", registroId: id, acao: "EXCLUIR", valorAnterior: dados,
      descricao: `Mandato excluído: ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}.`, ip: meta.ip,
    });
  });
  return m.parlamentarId;
}

// ---------- vínculo demanda ↔ mandato ----------

async function demandaEditavel(db: Db | Tx, ator: Ator, demandaId: string) {
  const d = await db.demanda.findUnique({ where: { id: demandaId } });
  if (!d) throw naoEncontrado("Demanda não encontrada.");
  if (!podeEditarRegistro(ator, d)) throw proibir("Você só pode alterar demandas sob sua responsabilidade ou criadas por você.");
  return d;
}

const descreverVinculo = (tipo: TipoParticipacao, m: { cargo: CargoParlamentar; legislatura: string | null; parlamentar: { nome: string } }) =>
  `${ROTULO_PARTICIPACAO[tipo]}: ${m.parlamentar.nome} (${ROTULO_CARGO[m.cargo]}${m.legislatura ? `, ${m.legislatura}` : ""})`;

export async function vincularMandato(db: Db, ator: Ator, demandaId: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  const r = vinculoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  await demandaEditavel(db, ator, demandaId);
  const m = await db.mandato.findUnique({ where: { id: r.data.mandatoId }, include: { parlamentar: true } });
  if (!m) throw validacao("Mandato inválido.");
  if (m.parlamentar.proprio) throw validacao("A demanda já é do mandato próprio. Vincule mandatos parceiros.");
  const tipo = r.data.tipo as TipoParticipacao;
  const existe = await db.demandaMandato.findUnique({ where: { demandaId_mandatoId_tipo: { demandaId, mandatoId: m.id, tipo } } });
  const repetido = conflito("Esse mandato já está vinculado à demanda com essa participação.");
  if (existe) throw repetido;
  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.demandaMandato.create({ data: { demandaId, mandatoId: m.id, tipo, observacoes: r.data.observacoes, usuarioId: ator.id } });
      await tx.demandaHistorico.create({
        data: { demandaId, usuarioId: ator.id, tipo: "ARTICULACAO", descricao: `${descreverVinculo(tipo, m)}${r.data.observacoes ? ` — ${r.data.observacoes}` : ""}` },
      });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "demanda_mandato", registroId: v.id, acao: "CRIAR", valorNovo: v, ip: meta.ip });
      return v;
    });
  } catch (e) {
    if (ehUnico(e)) throw repetido;
    throw e;
  }
}

export async function desvincularMandato(db: Db, ator: Ator, vinculoId: string, meta: Meta = {}) {
  const v = await db.demandaMandato.findUnique({ where: { id: vinculoId }, include: { mandato: { include: { parlamentar: true } } } });
  if (!v) throw naoEncontrado("Vínculo não encontrado.");
  await demandaEditavel(db, ator, v.demandaId);
  const { mandato, ...dados } = v;
  await db.$transaction(async (tx) => {
    await tx.demandaMandato.delete({ where: { id: v.id } });
    await tx.demandaHistorico.create({
      data: { demandaId: v.demandaId, usuarioId: ator.id, tipo: "ARTICULACAO", descricao: `Removeu vínculo — ${descreverVinculo(v.tipo, mandato)}` },
    });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "demanda_mandato", registroId: v.id, acao: "EXCLUIR", valorAnterior: dados, ip: meta.ip });
  });
  return v.demandaId;
}

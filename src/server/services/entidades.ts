import type { Prisma, TipoEntidade, TipoParticipacao } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, pode, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import { formatarCnpj } from "@/lib/emendas";
import { ROTULO_TIPO_ENTIDADE } from "@/lib/entidades";
import { mascararEmail, mascararTelefone } from "@/lib/mascara";
import { ROTULO_CARGO, ROTULO_PARTICIPACAO } from "@/lib/parlamentares";
import { entidadeSchema, vinculoEntidadeSchema, type EntidadeEntrada } from "@/lib/validacao/entidade";
import { rotuloMandato } from "@/server/services/parlamentares";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

const ROTULO_CAMPO: Record<string, string> = {
  nome: "nome", cnpj: "CNPJ", tipo: "tipo", temaId: "área de atuação", endereco: "endereço", bairroId: "bairro", telefone: "telefone",
  email: "e-mail", responsavel: "responsável", observacoes: "observações", ativo: "situação",
};
const listaCampos = (novo: Record<string, unknown>) => Object.keys(novo).map((k) => ROTULO_CAMPO[k] ?? k).join(", ");

/** Quem cadastrou (assessor) ou quem edita tudo. */
export const podeEditarEntidade = (ator: Ator, e: { criadoPorId: string | null }) => podeEditarRegistro(ator, { criadoPorId: e.criadoPorId });

/** Contatos de entidade são institucionais; só o perfil Consulta vê mascarado (o responsável pode ser pessoa física). */
const verContatoEntidade = (ator: Ator) => ator.perfil !== "CONSULTA";

// ---------- consulta ----------

export type FiltrosEntidade = { q?: string; tipo?: string; temaId?: string; regional?: string; bairro?: string; situacao?: string; pagina?: number };

function whereEntidades(f: FiltrosEntidade): Prisma.EntidadeWhereInput {
  const e: Prisma.EntidadeWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    const digitos = q.replace(/\D/g, "");
    e.push({ OR: [
      { nome: { contains: q, mode: "insensitive" } },
      { responsavel: { contains: q, mode: "insensitive" } },
      ...(digitos.length >= 4 ? [{ cnpj: { contains: digitos } }] : []),
    ] });
  }
  if (f.tipo && f.tipo in ROTULO_TIPO_ENTIDADE) e.push({ tipo: f.tipo as TipoEntidade });
  if (f.temaId && Number(f.temaId)) e.push({ temaId: Number(f.temaId) });
  if (f.bairro && Number(f.bairro)) e.push({ bairroId: Number(f.bairro) });
  else if (f.regional && Number(f.regional)) e.push({ bairro: { regionalId: Number(f.regional) } });
  if (f.situacao === "inativas") e.push({ ativo: false });
  else if (f.situacao !== "todas") e.push({ ativo: true });
  return e.length ? { AND: e } : {};
}

export async function listarEntidades(db: Db, ator: Ator, f: FiltrosEntidade = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereEntidades(f);
  const [itens, total] = await Promise.all([
    db.entidade.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true, nome: true, cnpj: true, tipo: true, ativo: true, responsavel: true,
        tema: { select: { nome: true } },
        bairro: { select: { nome: true, regional: { select: { nome: true } } } },
        _count: { select: { demandas: true, emendas: true, compromissos: true, mandatos: true } },
      },
    }),
    db.entidade.count({ where }),
  ]);
  return { itens, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function obterEntidade(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const e = await db.entidade.findUnique({
    where: { id },
    include: {
      tema: true,
      bairro: { include: { regional: true } },
      criadoPor: { select: { nome: true } },
      demandas: {
        orderBy: { criadoEm: "desc" },
        take: 100,
        select: { id: true, protocolo: true, status: true, descricao: true, tema: { select: { nome: true } } },
      },
      emendas: {
        orderBy: { criadoEm: "desc" },
        take: 100,
        select: { id: true, codigo: true, numero: true, ano: true, esfera: true, status: true, objeto: true, valorIndicado: true, valorAprovado: true, valorPago: true },
      },
      mandatos: {
        orderBy: { criadoEm: "asc" },
        include: { mandato: { include: { parlamentar: { select: { id: true, nome: true, partido: true, proprio: true } } } }, usuario: { select: { nome: true } } },
      },
    },
  });
  if (!e) throw naoEncontrado("Entidade não encontrada.");
  const historico = await db.auditLog.findMany({
    where: { OR: [{ entidade: "entidade", registroId: id }, { entidade: "entidade_mandato", registroId: { in: e.mandatos.map((m) => m.id) } }, { entidade: "entidade_mandato", valorAnterior: { path: ["entidadeId"], equals: id } }] },
    orderBy: { data: "desc" },
    take: 50,
    include: { usuario: { select: { nome: true } } },
  });
  const contatoVisivel = verContatoEntidade(ator);
  if (!contatoVisivel) {
    e.telefone = e.telefone ? mascararTelefone(e.telefone) : null;
    e.email = e.email ? mascararEmail(e.email) : null;
  }
  return { ...e, historico, contatoVisivel, podeEditar: podeEditarEntidade(ator, e) };
}

export async function opcoesFormEntidade(db: Db) {
  const [temas, regionais] = await Promise.all([
    db.tema.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.regional.findMany({ orderBy: { nome: "asc" }, include: { bairros: { orderBy: { nome: "asc" }, select: { id: true, nome: true } } } }),
  ]);
  return { temas, regionais };
}

/** Entidades ativas para os selects de demanda, emenda e agenda. */
export async function opcoesEntidades(db: Db, incluirId?: string | null) {
  const es = await db.entidade.findMany({
    where: { OR: [{ ativo: true }, ...(incluirId ? [{ id: incluirId }] : [])] },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cnpj: true },
  });
  return es.map((e) => ({ id: e.id, rotulo: e.cnpj ? `${e.nome} — ${formatarCnpj(e.cnpj)}` : e.nome }));
}

export type EntidadeSemelhante = { id: string; nome: string; cnpj: string | null; ativo: boolean };

/** Possíveis duplicadas pelo nome (trigram) ou pelo mesmo CNPJ. */
export async function buscarEntidadesSemelhantes(db: Db, ator: Ator, e: { nome?: string; cnpj?: string | null }, ignorarId?: string): Promise<EntidadeSemelhante[]> {
  exigir(ator, "dados:ver");
  const nome = (e.nome ?? "").trim();
  const cnpj = (e.cnpj ?? "").replace(/\D/g, "");
  const ignorar = ignorarId ?? "00000000-0000-0000-0000-000000000000";
  return db.$queryRaw<EntidadeSemelhante[]>`
    SELECT id, nome, cnpj, ativo FROM entidade
    WHERE id <> ${ignorar}::uuid
      AND ((${cnpj} <> '' AND cnpj = ${cnpj}) OR (${nome} <> '' AND similarity(nome, ${nome}) > 0.45))
    ORDER BY similarity(nome, ${nome}) DESC
    LIMIT 5`;
}

// ---------- escrita ----------

async function validarReferencias(db: Db | Tx, d: { temaId: number | null; bairroId: number | null }) {
  if (d.temaId && !(await db.tema.findUnique({ where: { id: d.temaId } }))) throw validacao("Área de atuação inválida.");
  if (d.bairroId && !(await db.bairro.findUnique({ where: { id: d.bairroId } }))) throw validacao("Bairro inválido.");
}

function normalizar(entrada: EntidadeEntrada) {
  const r = entidadeSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  return { ...r.data, tipo: r.data.tipo as TipoEntidade };
}

async function checarCnpj(db: Db | Tx, cnpj: string | null, ignorarId?: string) {
  if (!cnpj) return;
  const outra = await db.entidade.findFirst({ where: { cnpj, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (outra) throw conflito(`Já existe entidade com esse CNPJ: ${outra.nome}.`);
}

const cnpjRepetido = () => conflito("Já existe entidade com esse CNPJ.");

export async function criarEntidade(db: Db, ator: Ator, entrada: EntidadeEntrada, meta: Meta = {}) {
  exigir(ator, "dados:criar");
  const dados = normalizar(entrada);
  await validarReferencias(db, dados);
  await checarCnpj(db, dados.cnpj);
  try {
    return await db.$transaction(async (tx) => {
      const e = await tx.entidade.create({ data: { ...dados, criadoPorId: ator.id } });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "entidade", registroId: e.id, acao: "CRIAR", valorNovo: e,
        descricao: `Entidade cadastrada: ${e.nome} (${ROTULO_TIPO_ENTIDADE[e.tipo]}).`, ip: meta.ip,
      });
      return e;
    });
  } catch (e) {
    if (ehUnico(e)) throw cnpjRepetido();
    throw e;
  }
}

async function carregarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const e = await db.entidade.findUnique({ where: { id } });
  if (!e) throw naoEncontrado("Entidade não encontrada.");
  if (!podeEditarEntidade(ator, e)) throw proibir("Você só pode editar entidades que você cadastrou.");
  return e;
}

export async function atualizarEntidade(db: Db, ator: Ator, id: string, entrada: EntidadeEntrada, meta: Meta = {}) {
  const dados = normalizar(entrada);
  const atual = await carregarParaEditar(db, ator, id);
  await validarReferencias(db, dados);
  await checarCnpj(db, dados.cnpj, id);
  const d = diferenca(atual as unknown as Record<string, unknown>, dados);
  if (!d.mudou) return atual;
  try {
    return await db.$transaction(async (tx) => {
      const e = await tx.entidade.update({ where: { id }, data: dados });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "entidade", registroId: id, acao: "EDITAR",
        valorAnterior: d.anterior, valorNovo: d.novo, descricao: `Alterou: ${listaCampos(d.novo)}.`, ip: meta.ip,
      });
      return e;
    });
  } catch (e) {
    if (ehUnico(e)) throw cnpjRepetido();
    throw e;
  }
}

// ---------- entidade ↔ mandato ----------

const descreverVinculo = (tipo: TipoParticipacao, m: { cargo: keyof typeof ROTULO_CARGO; legislatura: string | null; dataInicio: Date; dataFim: Date | null; parlamentar: { nome: string } }) =>
  `${ROTULO_PARTICIPACAO[tipo]}: ${m.parlamentar.nome} (${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)})`;

export async function vincularMandatoEntidade(db: Db, ator: Ator, entidadeId: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  const r = vinculoEntidadeSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  await carregarParaEditar(db, ator, entidadeId);
  const m = await db.mandato.findUnique({ where: { id: r.data.mandatoId }, include: { parlamentar: true } });
  if (!m) throw validacao("Mandato inválido.");
  const tipo = r.data.tipo as TipoParticipacao;
  const repetido = conflito("Esse mandato já está vinculado à entidade com essa relação.");
  if (await db.entidadeMandato.findUnique({ where: { entidadeId_mandatoId_tipo: { entidadeId, mandatoId: m.id, tipo } } })) throw repetido;
  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.entidadeMandato.create({ data: { entidadeId, mandatoId: m.id, tipo, observacoes: r.data.observacoes, usuarioId: ator.id } });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "entidade_mandato", registroId: v.id, acao: "CRIAR", valorNovo: v,
        descricao: `Vinculou mandato — ${descreverVinculo(tipo, m)}.`, ip: meta.ip,
      });
      return v;
    });
  } catch (e) {
    if (ehUnico(e)) throw repetido;
    throw e;
  }
}

export async function desvincularMandatoEntidade(db: Db, ator: Ator, vinculoId: string, meta: Meta = {}) {
  const v = await db.entidadeMandato.findUnique({ where: { id: vinculoId }, include: { mandato: { include: { parlamentar: true } } } });
  if (!v) throw naoEncontrado("Vínculo não encontrado.");
  await carregarParaEditar(db, ator, v.entidadeId);
  const { mandato, ...dados } = v;
  await db.$transaction(async (tx) => {
    await tx.entidadeMandato.delete({ where: { id: v.id } });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "entidade_mandato", registroId: v.id, acao: "EXCLUIR", valorAnterior: dados,
      descricao: `Removeu vínculo — ${descreverVinculo(v.tipo, mandato)}.`, ip: meta.ip,
    });
  });
  return v.entidadeId;
}

/** Mandatos (inclusive o próprio) para relacionar com entidades. */
export async function opcoesMandatosEntidade(db: Db) {
  const ms = await db.mandato.findMany({
    where: { parlamentar: { ativo: true } },
    orderBy: [{ parlamentar: { proprio: "desc" } }, { parlamentar: { nome: "asc" } }, { dataInicio: "desc" }],
    select: { id: true, legislatura: true, cargo: true, dataInicio: true, dataFim: true, partido: true, parlamentar: { select: { nome: true, partido: true, proprio: true } } },
  });
  return ms.map((m) => {
    const partido = m.partido ?? m.parlamentar.partido;
    return { id: m.id, rotulo: `${m.parlamentar.nome}${partido ? ` (${partido})` : ""}${m.parlamentar.proprio ? " [mandato próprio]" : ""} — ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}` };
  });
}

export const permiteCriarEntidade = (ator: Ator) => pode(ator, "dados:criar");

import type { Prisma, StatusCompromisso, TipoCompromisso } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, pode, podeEditarRegistro, proibir, type Ator } from "@/server/authz";
import { diferenca, registrarAuditoria } from "@/server/audit";
import { conflito, naoEncontrado, validacao } from "@/server/errors";
import {
  ROTULO_STATUS_COMPROMISSO, ROTULO_TIPO_COMPROMISSO, ROTULO_TIPO_VINCULO, STATUS_EXIGE_MOTIVO_COMPROMISSO, STATUS_OCUPA_AGENDA,
  diaLocal, diasDoCalendario, formatarPeriodo, inicioDoDia, inicioSemana, somarDiasISO, type TipoVinculo,
} from "@/lib/agenda";
import { hojeISO } from "@/lib/demandas";
import { ROTULO_CARGO } from "@/lib/parlamentares";
import { alvoSchema, compromissoSchema, resultadoSchema, statusCompromissoSchema, type CompromissoEntrada } from "@/lib/validacao/agenda";
import { rotuloMandato } from "@/server/services/parlamentares";

type Meta = { ip?: string };

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

const ROTULO_CAMPO: Record<string, string> = {
  titulo: "título", tipo: "tipo", inicio: "início", fim: "término", local: "local", bairroId: "bairro", pauta: "pauta",
  agendaVereador: "agenda do vereador", responsavelId: "responsável", participantes: "participantes",
};

export const podeEditarCompromisso = (ator: Ator, c: { responsavelId: string | null; criadoPorId: string | null }) => podeEditarRegistro(ator, c);

/** Agenda do vereador: só Admin/Coordenação confirmam. */
export const podeConfirmarAgendaVereador = (ator: Ator) => pode(ator, "cadastros_base:gerenciar");

const COLUNA: Record<TipoVinculo, "demandaId" | "emendaId" | "entidadeId" | "parlamentarId" | "mandatoId"> = {
  demanda: "demandaId", emenda: "emendaId", entidade: "entidadeId", parlamentar: "parlamentarId", mandato: "mandatoId",
};

const incluirVinculos = {
  orderBy: { criadoEm: "asc" },
  include: {
    demanda: { select: { id: true, protocolo: true, status: true } },
    emenda: { select: { id: true, codigo: true, status: true } },
    entidade: { select: { id: true, nome: true } },
    parlamentar: { select: { id: true, nome: true } },
    mandato: { select: { id: true, cargo: true, legislatura: true, dataInicio: true, dataFim: true, parlamentar: { select: { id: true, nome: true } } } },
  },
} satisfies Prisma.Compromisso$vinculosArgs;

type VinculoCarregado = Prisma.CompromissoVinculoGetPayload<{ include: (typeof incluirVinculos)["include"] }>;

/** Rótulo, link e tipo de um vínculo carregado. */
export function descreverAlvo(v: VinculoCarregado): { tipo: TipoVinculo; rotulo: string; href: string } {
  if (v.demanda) return { tipo: "demanda", rotulo: v.demanda.protocolo, href: `/demandas/${v.demanda.id}` };
  if (v.emenda) return { tipo: "emenda", rotulo: v.emenda.codigo, href: `/emendas/${v.emenda.id}` };
  if (v.entidade) return { tipo: "entidade", rotulo: v.entidade.nome, href: `/entidades/${v.entidade.id}` };
  if (v.parlamentar) return { tipo: "parlamentar", rotulo: v.parlamentar.nome, href: `/parlamentares/${v.parlamentar.id}` };
  const m = v.mandato!;
  return { tipo: "mandato", rotulo: `${m.parlamentar.nome} — ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}`, href: `/parlamentares/${m.parlamentar.id}` };
}

// ---------- consulta ----------

export type VisaoAgenda = "semana" | "mes" | "lista";
export type FiltrosAgenda = {
  visao?: string; data?: string; q?: string; tipo?: string; status?: string; responsavel?: string; vereador?: string; periodo?: string; pagina?: number;
};

export function intervaloDaVisao(visao: VisaoAgenda, data: string) {
  if (visao === "semana") {
    const de = inicioSemana(data);
    return { de, ate: somarDiasISO(de, 7) };
  }
  const dias = diasDoCalendario(data);
  return { de: dias[0], ate: somarDiasISO(dias[dias.length - 1], 1) };
}

function whereAgenda(ator: Ator, f: FiltrosAgenda): Prisma.CompromissoWhereInput {
  const e: Prisma.CompromissoWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    e.push({ OR: [
      { titulo: { contains: q, mode: "insensitive" } },
      { local: { contains: q, mode: "insensitive" } },
      { pauta: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (f.tipo && f.tipo in ROTULO_TIPO_COMPROMISSO) e.push({ tipo: f.tipo as TipoCompromisso });
  if (f.status && f.status in ROTULO_STATUS_COMPROMISSO) e.push({ status: f.status as StatusCompromisso });
  else if (f.status !== "todos") e.push({ status: { not: "CANCELADO" } });
  if (f.vereador === "1") e.push({ agendaVereador: true });
  const pessoa = f.responsavel === "eu" ? ator.id : f.responsavel && /^[0-9a-f-]{36}$/i.test(f.responsavel) ? f.responsavel : null;
  if (pessoa) e.push({ OR: [{ responsavelId: pessoa }, { participantes: { some: { usuarioId: pessoa } } }] });
  return e.length ? { AND: e } : {};
}

const selecaoLista = {
  id: true, titulo: true, tipo: true, status: true, inicio: true, fim: true, local: true, agendaVereador: true,
  bairro: { select: { nome: true } },
  responsavel: { select: { nome: true } },
  _count: { select: { participantes: true, vinculos: true } },
} satisfies Prisma.CompromissoSelect;

/** Semana/mês: todos do intervalo. Lista: paginada, próximos (padrão) ou passados. */
export async function listarCompromissos(db: Db, ator: Ator, f: FiltrosAgenda = {}) {
  exigir(ator, "dados:ver");
  const visao: VisaoAgenda = f.visao === "mes" || f.visao === "lista" ? f.visao : "semana";
  const data = f.data && /^\d{4}-\d{2}-\d{2}$/.test(f.data) && !Number.isNaN(Date.parse(f.data)) ? f.data : hojeISO();
  const base = whereAgenda(ator, f);
  if (visao !== "lista") {
    const { de, ate } = intervaloDaVisao(visao, data);
    const itens = await db.compromisso.findMany({
      where: { AND: [base, { inicio: { lt: inicioDoDia(ate) } }, { fim: { gt: inicioDoDia(de) } }] },
      orderBy: [{ inicio: "asc" }, { titulo: "asc" }],
      take: 1000,
      select: selecaoLista,
    });
    return { visao, data, de, ate, itens, total: itens.length, pagina: 1, paginas: 1 };
  }
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const agora = new Date();
  const passados = f.periodo === "passados";
  const where = { AND: [base, passados ? { fim: { lte: agora } } : { fim: { gt: agora } }] };
  const [itens, total] = await Promise.all([
    db.compromisso.findMany({ where, orderBy: { inicio: passados ? "desc" : "asc" }, skip: (pagina - 1) * porPagina, take: porPagina, select: selecaoLista }),
    db.compromisso.count({ where }),
  ]);
  return { visao, data, de: null, ate: null, itens, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function obterCompromisso(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const c = await db.compromisso.findUnique({
    where: { id },
    include: {
      bairro: { include: { regional: true } },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
      participantes: { include: { usuario: { select: { id: true, nome: true } } }, orderBy: { usuario: { nome: "asc" } } },
      vinculos: incluirVinculos,
      historico: { orderBy: { data: "desc" }, include: { usuario: { select: { nome: true } } } },
    },
  });
  if (!c) throw naoEncontrado("Compromisso não encontrado.");
  const podeEditar = podeEditarCompromisso(ator, c);
  const participante = c.participantes.some((p) => p.usuarioId === ator.id);
  return {
    ...c,
    alvos: c.vinculos.map((v) => ({ id: v.id, ...descreverAlvo(v) })),
    podeEditar,
    podeRegistrar: podeEditar || (participante && pode(ator, "dados:criar")),
    podeConfirmar: !c.agendaVereador || podeConfirmarAgendaVereador(ator),
  };
}

/** Compromissos ligados a um registro (para as páginas de demanda, emenda, entidade e parlamentar). */
export async function compromissosVinculados(db: Db, ator: Ator, alvo: { tipo: TipoVinculo; id: string; mandatoIds?: string[] }) {
  exigir(ator, "dados:ver");
  const ou: Prisma.CompromissoVinculoWhereInput[] = [{ [COLUNA[alvo.tipo]]: alvo.id }];
  if (alvo.mandatoIds?.length) ou.push({ mandatoId: { in: alvo.mandatoIds } });
  return db.compromisso.findMany({
    where: { vinculos: { some: { OR: ou } } },
    orderBy: { inicio: "desc" },
    take: 30,
    select: { id: true, titulo: true, tipo: true, status: true, inicio: true, fim: true, resultado: true },
  });
}

export async function opcoesAgenda(db: Db) {
  const [regionais, usuarios] = await Promise.all([
    db.regional.findMany({ orderBy: { nome: "asc" }, include: { bairros: { orderBy: { nome: "asc" }, select: { id: true, nome: true } } } }),
    db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, perfil: true } }),
  ]);
  return {
    regionais,
    participantes: usuarios.map((u) => ({ id: u.id, nome: u.nome })),
    responsaveis: usuarios.filter((u) => u.perfil !== "CONSULTA").map((u) => ({ id: u.id, nome: u.nome })),
  };
}
export type OpcoesAgenda = Awaited<ReturnType<typeof opcoesAgenda>>;

/** Registros que podem ser ligados a um compromisso, agrupados (valor = "tipo:id"). */
export async function opcoesAlvos(db: Db) {
  const [demandas, emendas, entidades, parlamentares, mandatos] = await Promise.all([
    db.demanda.findMany({ orderBy: { criadoEm: "desc" }, take: 300, select: { id: true, protocolo: true, descricao: true } }),
    db.emenda.findMany({ orderBy: { criadoEm: "desc" }, take: 300, select: { id: true, codigo: true, objeto: true } }),
    db.entidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.parlamentar.findMany({ where: { ativo: true }, orderBy: [{ proprio: "desc" }, { nome: "asc" }], select: { id: true, nome: true } }),
    db.mandato.findMany({
      where: { parlamentar: { ativo: true } },
      orderBy: [{ parlamentar: { nome: "asc" } }, { dataInicio: "desc" }],
      select: { id: true, cargo: true, legislatura: true, dataInicio: true, dataFim: true, parlamentar: { select: { nome: true } } },
    }),
  ]);
  const curto = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);
  return [
    { tipo: "entidade" as const, opcoes: entidades.map((e) => ({ valor: `entidade:${e.id}`, rotulo: e.nome })) },
    { tipo: "demanda" as const, opcoes: demandas.map((d) => ({ valor: `demanda:${d.id}`, rotulo: `${d.protocolo} — ${curto(d.descricao)}` })) },
    { tipo: "emenda" as const, opcoes: emendas.map((e) => ({ valor: `emenda:${e.id}`, rotulo: `${e.codigo} — ${curto(e.objeto)}` })) },
    { tipo: "parlamentar" as const, opcoes: parlamentares.map((p) => ({ valor: `parlamentar:${p.id}`, rotulo: p.nome })) },
    { tipo: "mandato" as const, opcoes: mandatos.map((m) => ({ valor: `mandato:${m.id}`, rotulo: `${m.parlamentar.nome} — ${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)}` })) },
  ].map((g) => ({ ...g, rotulo: ROTULO_TIPO_VINCULO[g.tipo] }));
}
export type OpcoesAlvos = Awaited<ReturnType<typeof opcoesAlvos>>;

// ---------- choque de horário ----------

export type Choque = { id: string; titulo: string; periodo: string; pessoas: string[]; agendaVereador: boolean };

/** Compromissos ativos no mesmo intervalo com as mesmas pessoas (responsável/participantes) ou ambos na agenda do vereador. */
export async function buscarChoques(
  db: Db,
  ator: Ator,
  c: { inicio: Date; fim: Date; responsavelId: string | null; participantes: string[]; agendaVereador: boolean },
  ignorarId?: string,
): Promise<Choque[]> {
  exigir(ator, "dados:ver");
  const pessoas = [...new Set([c.responsavelId, ...c.participantes].filter(Boolean) as string[])];
  const quem: Prisma.CompromissoWhereInput[] = [];
  if (pessoas.length) quem.push({ responsavelId: { in: pessoas } }, { participantes: { some: { usuarioId: { in: pessoas } } } });
  if (c.agendaVereador) quem.push({ agendaVereador: true });
  if (!quem.length) return [];
  const outros = await db.compromisso.findMany({
    where: {
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
      status: { in: STATUS_OCUPA_AGENDA },
      inicio: { lt: c.fim },
      fim: { gt: c.inicio },
      OR: quem,
    },
    orderBy: { inicio: "asc" },
    take: 10,
    include: { responsavel: { select: { id: true, nome: true } }, participantes: { include: { usuario: { select: { id: true, nome: true } } } } },
  });
  return outros.map((o) => {
    const envolvidos = [o.responsavel, ...o.participantes.map((p) => p.usuario)].filter((u): u is { id: string; nome: string } => !!u && pessoas.includes(u.id));
    return {
      id: o.id, titulo: o.titulo, periodo: formatarPeriodo(o.inicio, o.fim), agendaVereador: o.agendaVereador && c.agendaVereador,
      pessoas: [...new Set(envolvidos.map((u) => u.nome))],
    };
  });
}

// ---------- escrita ----------

export function normalizarCompromisso(entrada: CompromissoEntrada) {
  const r = compromissoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const { participantes, ...dados } = r.data;
  return { dados: { ...dados, tipo: dados.tipo as TipoCompromisso }, participantes };
}

async function validarReferencias(db: Db | Tx, d: { bairroId: number | null; responsavelId: string | null }, participantes: string[]) {
  if (d.bairroId && !(await db.bairro.findUnique({ where: { id: d.bairroId } }))) throw validacao("Bairro inválido.");
  if (d.responsavelId) {
    const u = await db.usuario.findUnique({ where: { id: d.responsavelId } });
    if (!u || !u.ativo || u.perfil === "CONSULTA") throw validacao("O responsável precisa ser um usuário ativo que não seja de consulta.");
  }
  if (participantes.length) {
    const n = await db.usuario.count({ where: { id: { in: participantes }, ativo: true } });
    if (n !== participantes.length) throw validacao("Há participante inválido ou inativo.");
  }
}

async function resolverAlvo(db: Db | Tx, valor: string) {
  const r = alvoSchema.safeParse(valor);
  if (!r.success) throw primeiroErro(r);
  const { tipo, id } = r.data;
  const achou =
    tipo === "demanda" ? await db.demanda.findUnique({ where: { id }, select: { protocolo: true } }).then((x) => x?.protocolo)
    : tipo === "emenda" ? await db.emenda.findUnique({ where: { id }, select: { codigo: true } }).then((x) => x?.codigo)
    : tipo === "entidade" ? await db.entidade.findUnique({ where: { id }, select: { nome: true } }).then((x) => x?.nome)
    : tipo === "parlamentar" ? await db.parlamentar.findUnique({ where: { id }, select: { nome: true } }).then((x) => x?.nome)
    : await db.mandato.findUnique({ where: { id }, include: { parlamentar: { select: { nome: true } } } }).then((m) => m && `${m.parlamentar.nome} (${ROTULO_CARGO[m.cargo]}, ${rotuloMandato(m)})`);
  if (!achou) throw validacao(`${ROTULO_TIPO_VINCULO[tipo]} não encontrada(o).`);
  return { tipo, id, coluna: COLUNA[tipo], rotulo: `${ROTULO_TIPO_VINCULO[tipo]} ${achou}` };
}

export async function criarCompromisso(
  db: Db, ator: Ator, entrada: CompromissoEntrada & { confirmado?: string | boolean | null; vinculo?: string | null }, meta: Meta = {},
) {
  exigir(ator, "dados:criar");
  const { dados, participantes } = normalizarCompromisso(entrada);
  await validarReferencias(db, dados, participantes);
  const querConfirmado = entrada.confirmado === true || entrada.confirmado === "on" || entrada.confirmado === "1";
  if (querConfirmado && dados.agendaVereador && !podeConfirmarAgendaVereador(ator)) {
    throw proibir("Compromissos na agenda do vereador entram como solicitados; só a coordenação confirma.");
  }
  const status: StatusCompromisso = querConfirmado ? "CONFIRMADO" : "SOLICITADO";
  const alvo = entrada.vinculo ? await resolverAlvo(db, entrada.vinculo) : null;
  return db.$transaction(async (tx) => {
    const c = await tx.compromisso.create({
      data: { ...dados, status, criadoPorId: ator.id, participantes: { create: participantes.map((usuarioId) => ({ usuarioId })) } },
    });
    await tx.compromissoHistorico.create({
      data: { compromissoId: c.id, usuarioId: ator.id, tipo: "CRIACAO", statusNovo: status, descricao: `Compromisso cadastrado como "${ROTULO_STATUS_COMPROMISSO[status]}" (${formatarPeriodo(c.inicio, c.fim)}).` },
    });
    if (alvo) {
      await tx.compromissoVinculo.create({ data: { compromissoId: c.id, [alvo.coluna]: alvo.id, usuarioId: ator.id } });
      await tx.compromissoHistorico.create({ data: { compromissoId: c.id, usuarioId: ator.id, tipo: "VINCULO", descricao: `Vinculado a ${alvo.rotulo}.` } });
    }
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "compromisso", registroId: c.id, acao: "CRIAR", valorNovo: { ...c, participantes }, ip: meta.ip });
    return c;
  });
}

async function carregarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const c = await db.compromisso.findUnique({ where: { id }, include: { participantes: true } });
  if (!c) throw naoEncontrado("Compromisso não encontrado.");
  if (!podeEditarCompromisso(ator, c)) throw proibir("Você só pode alterar compromissos sob sua responsabilidade ou criados por você.");
  return c;
}

export async function atualizarCompromisso(db: Db, ator: Ator, id: string, entrada: CompromissoEntrada, meta: Meta = {}) {
  const atual = await carregarParaEditar(db, ator, id);
  const { dados, participantes } = normalizarCompromisso(entrada);
  await validarReferencias(db, dados, participantes);
  const { participantes: partAtuais, ...resto } = atual;
  const antes = { ...resto, participantes: partAtuais.map((p) => p.usuarioId).sort() } as Record<string, unknown>;
  const d = diferenca(antes, { ...dados, participantes: [...participantes].sort() });
  if (!d.mudou) return atual;

  const coordena = podeConfirmarAgendaVereador(ator);
  const mudouHorario = "inicio" in d.novo || "fim" in d.novo;
  if (atual.agendaVereador && atual.status === "CONFIRMADO" && !coordena && (mudouHorario || "agendaVereador" in d.novo)) {
    throw proibir("Compromisso confirmado na agenda do vereador: só a coordenação muda horário ou retira da agenda.");
  }
  const voltaParaSolicitado = !atual.agendaVereador && dados.agendaVereador && atual.status === "CONFIRMADO" && !coordena;

  return db.$transaction(async (tx) => {
    const c = await tx.compromisso.update({
      where: { id },
      data: { ...dados, ...(voltaParaSolicitado ? { status: "SOLICITADO" as const } : {}) },
    });
    if ("participantes" in d.novo) {
      await tx.compromissoParticipante.deleteMany({ where: { compromissoId: id } });
      if (participantes.length) await tx.compromissoParticipante.createMany({ data: participantes.map((usuarioId) => ({ compromissoId: id, usuarioId })) });
    }
    const campos = Object.keys(d.novo).map((k) => ROTULO_CAMPO[k] ?? k);
    await tx.compromissoHistorico.create({
      data: { compromissoId: id, usuarioId: ator.id, tipo: "EDICAO", descricao: `Alterou: ${campos.join(", ")}.${mudouHorario ? ` Novo horário: ${formatarPeriodo(c.inicio, c.fim)}.` : ""}` },
    });
    if (voltaParaSolicitado) {
      await tx.compromissoHistorico.create({
        data: { compromissoId: id, usuarioId: ator.id, tipo: "STATUS", statusAnterior: "CONFIRMADO", statusNovo: "SOLICITADO", descricao: "Entrou na agenda do vereador: volta para solicitado até a coordenação confirmar." },
      });
    }
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "compromisso", registroId: id, acao: "EDITAR", valorAnterior: d.anterior, valorNovo: d.novo, ip: meta.ip });
    return c;
  });
}

export async function alterarStatusCompromisso(db: Db, ator: Ator, id: string, entrada: { status: string; motivo?: string | null }, meta: Meta = {}, agora = new Date()) {
  const r = statusCompromissoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const novo = r.data.status as StatusCompromisso;
  const atual = await carregarParaEditar(db, ator, id);
  if (atual.status === novo) throw validacao("O compromisso já está com esse status.");
  if (STATUS_EXIGE_MOTIVO_COMPROMISSO.includes(novo) && !r.data.motivo) throw validacao("Informe o motivo para adiar ou cancelar.");
  if (novo === "CONFIRMADO" && atual.agendaVereador && !podeConfirmarAgendaVereador(ator)) {
    throw proibir("Só a coordenação confirma compromissos na agenda do vereador.");
  }
  if (novo === "REALIZADO" && atual.inicio > agora) throw validacao("Só dá para marcar como realizado depois do início do compromisso.");
  return db.$transaction(async (tx) => {
    const c = await tx.compromisso.update({ where: { id }, data: { status: novo } });
    await tx.compromissoHistorico.create({
      data: {
        compromissoId: id, usuarioId: ator.id, tipo: "STATUS", statusAnterior: atual.status, statusNovo: novo,
        descricao: `${ROTULO_STATUS_COMPROMISSO[atual.status]} → ${ROTULO_STATUS_COMPROMISSO[novo]}${r.data.motivo ? `: ${r.data.motivo}` : ""}`,
      },
    });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "compromisso", registroId: id, acao: "EDITAR",
      valorAnterior: { status: atual.status }, valorNovo: { status: novo }, descricao: r.data.motivo ?? undefined, ip: meta.ip,
    });
    return c;
  });
}

async function carregarParaRegistrar(db: Db | Tx, ator: Ator, id: string) {
  const c = await db.compromisso.findUnique({ where: { id }, include: { participantes: true } });
  if (!c) throw naoEncontrado("Compromisso não encontrado.");
  const participante = c.participantes.some((p) => p.usuarioId === ator.id) && pode(ator, "dados:criar");
  if (!podeEditarCompromisso(ator, c) && !participante) throw proibir("Só o responsável, quem cadastrou, os participantes e a coordenação registram o resultado.");
  return c;
}

/** Resultado e encaminhamentos (a "ata"). Só depois de realizado. */
export async function registrarResultado(db: Db, ator: Ator, id: string, entrada: Record<string, unknown>, meta: Meta = {}) {
  const r = resultadoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const atual = await carregarParaRegistrar(db, ator, id);
  if (atual.status !== "REALIZADO") throw validacao("Marque o compromisso como realizado antes de registrar o resultado.");
  return db.$transaction(async (tx) => {
    const c = await tx.compromisso.update({ where: { id }, data: { resultado: r.data.resultado, encaminhamentos: r.data.encaminhamentos } });
    await tx.compromissoHistorico.create({
      data: { compromissoId: id, usuarioId: ator.id, tipo: "RESULTADO", descricao: atual.resultado ? "Atualizou o resultado/encaminhamentos." : "Registrou o resultado/encaminhamentos." },
    });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "compromisso", registroId: id, acao: "EDITAR",
      valorAnterior: { resultado: atual.resultado, encaminhamentos: atual.encaminhamentos }, valorNovo: r.data, ip: meta.ip,
    });
    return c;
  });
}

export async function comentarCompromisso(db: Db, ator: Ator, id: string, texto: string) {
  const t = (texto ?? "").trim();
  if (t.length < 2 || t.length > 2000) throw validacao("Escreva um comentário (até 2000 caracteres).");
  await carregarParaRegistrar(db, ator, id);
  return db.compromissoHistorico.create({ data: { compromissoId: id, usuarioId: ator.id, tipo: "COMENTARIO", descricao: t } });
}

export async function vincularCompromisso(db: Db, ator: Ator, id: string, valor: string, meta: Meta = {}) {
  await carregarParaEditar(db, ator, id);
  const alvo = await resolverAlvo(db, valor);
  const repetido = conflito("Esse registro já está vinculado ao compromisso.");
  if (await db.compromissoVinculo.findFirst({ where: { compromissoId: id, [alvo.coluna]: alvo.id } })) throw repetido;
  try {
    return await db.$transaction(async (tx) => {
      const v = await tx.compromissoVinculo.create({ data: { compromissoId: id, [alvo.coluna]: alvo.id, usuarioId: ator.id } });
      await tx.compromissoHistorico.create({ data: { compromissoId: id, usuarioId: ator.id, tipo: "VINCULO", descricao: `Vinculado a ${alvo.rotulo}.` } });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "compromisso_vinculo", registroId: v.id, acao: "CRIAR", valorNovo: v, ip: meta.ip });
      return v;
    });
  } catch (e) {
    if (ehUnico(e)) throw repetido;
    throw e;
  }
}

export async function desvincularCompromisso(db: Db, ator: Ator, vinculoId: string, meta: Meta = {}) {
  const v = await db.compromissoVinculo.findUnique({ where: { id: vinculoId }, include: incluirVinculos.include });
  if (!v) throw naoEncontrado("Vínculo não encontrado.");
  await carregarParaEditar(db, ator, v.compromissoId);
  const alvo = descreverAlvo(v);
  await db.$transaction(async (tx) => {
    await tx.compromissoVinculo.delete({ where: { id: v.id } });
    await tx.compromissoHistorico.create({
      data: { compromissoId: v.compromissoId, usuarioId: ator.id, tipo: "VINCULO", descricao: `Removeu vínculo com ${ROTULO_TIPO_VINCULO[alvo.tipo].toLowerCase()} ${alvo.rotulo}.` },
    });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "compromisso_vinculo", registroId: v.id, acao: "EXCLUIR",
      valorAnterior: { compromissoId: v.compromissoId, demandaId: v.demandaId, emendaId: v.emendaId, entidadeId: v.entidadeId, parlamentarId: v.parlamentarId, mandatoId: v.mandatoId },
      ip: meta.ip,
    });
  });
  return v.compromissoId;
}

/** Contagem para o dashboard: compromissos de hoje e da semana (não cancelados/adiados). */
export async function contadoresAgenda(db: Db, ator: Ator, hoje = hojeISO()) {
  exigir(ator, "dados:ver");
  const ativos = { status: { in: STATUS_OCUPA_AGENDA } };
  const fimHoje = inicioDoDia(somarDiasISO(hoje, 1));
  const [hojeN, semana, pendentes] = await Promise.all([
    db.compromisso.count({ where: { ...ativos, inicio: { lt: fimHoje }, fim: { gt: inicioDoDia(hoje) } } }),
    db.compromisso.count({ where: { ...ativos, inicio: { gte: inicioDoDia(hoje), lt: inicioDoDia(somarDiasISO(hoje, 7)) } } }),
    db.compromisso.count({ where: { status: "SOLICITADO", agendaVereador: true, fim: { gt: new Date() } } }),
  ]);
  return { hoje: hojeN, semana, pendentes };
}

export const diaDoCompromisso = (c: { inicio: Date }) => diaLocal(c.inicio);

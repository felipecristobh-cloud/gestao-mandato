import type { Prisma, Prioridade, StatusDemanda, TipoDemanda } from "@prisma/client";
import type { Db, Tx } from "@/server/db";
import { exigir, pode, podeEditarRegistro, podeVerContato, proibir, type Ator } from "@/server/authz";
import { registrarAuditoria, diferenca } from "@/server/audit";
import { naoEncontrado, validacao } from "@/server/errors";
import { mascararEmail, mascararTelefone } from "@/lib/mascara";
import {
  ROTULO_STATUS, STATUS_ABERTOS, STATUS_FINAIS, deISO, hojeISO, somarDias, type FiltroPrazo,
} from "@/lib/demandas";
import {
  demandaAtualizarSchema, demandaCriarSchema, encaminhamentoSchema, retornoSchema, statusSchema,
  type DemandaAtualizar, type DemandaCriar,
} from "@/lib/validacao/demanda";

function primeiroErro(r: { error: { issues: { message: string }[] } }) {
  return validacao(r.error.issues[0]?.message ?? "Dados inválidos.");
}

const ROTULO_CAMPO: Record<string, string> = {
  endereco: "endereço", bairroId: "bairro", temaId: "tema", tipo: "tipo", descricao: "descrição", prioridade: "prioridade",
  prazo: "prazo", responsavelId: "responsável", orgaoId: "órgão", observacoes: "observações",
  solicitanteNome: "nome do solicitante", telefone: "telefone", email: "e-mail",
};

// ---------- consulta ----------

export type FiltrosDemanda = {
  q?: string;
  status?: string;
  temaId?: string;
  regionalId?: string;
  bairroId?: string;
  prioridade?: string;
  responsavel?: string; // "eu" | "sem" | uuid
  prazo?: FiltroPrazo | string;
  pagina?: number;
};

function whereDemandas(ator: Ator, f: FiltrosDemanda, hoje = hojeISO()): Prisma.DemandaWhereInput {
  const e: Prisma.DemandaWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    e.push({ OR: [
      { protocolo: { contains: q, mode: "insensitive" } },
      { descricao: { contains: q, mode: "insensitive" } },
      { pessoa: { nome: { contains: q, mode: "insensitive" } } },
      { endereco: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (f.status === "abertas") e.push({ status: { in: STATUS_ABERTOS } });
  else if (f.status === "concluidas") e.push({ status: { in: STATUS_FINAIS } });
  else if (f.status && (ROTULO_STATUS as Record<string, string>)[f.status]) e.push({ status: f.status as StatusDemanda });
  if (f.temaId && /^\d+$/.test(f.temaId)) e.push({ temaId: Number(f.temaId) });
  if (f.bairroId && /^\d+$/.test(f.bairroId)) e.push({ bairroId: Number(f.bairroId) });
  if (f.regionalId && /^\d+$/.test(f.regionalId)) e.push({ bairro: { regionalId: Number(f.regionalId) } });
  if (f.prioridade && ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(f.prioridade)) e.push({ prioridade: f.prioridade as Prioridade });
  if (f.responsavel === "eu") e.push({ responsavelId: ator.id });
  else if (f.responsavel === "sem") e.push({ responsavelId: null });
  else if (f.responsavel && /^[0-9a-f-]{36}$/i.test(f.responsavel)) e.push({ responsavelId: f.responsavel });

  const abertas = { status: { in: STATUS_ABERTOS } };
  const h = deISO(hoje);
  switch (f.prazo) {
    case "atrasadas": e.push(abertas, { prazo: { lt: h } }); break;
    case "hoje": e.push(abertas, { prazo: h }); break;
    case "7": case "15": case "30":
      e.push(abertas, { prazo: { gte: h, lte: deISO(somarDias(hoje, Number(f.prazo))) } }); break;
    case "sem": e.push(abertas, { prazo: null }); break;
  }
  return e.length ? { AND: e } : {};
}

export async function listarDemandas(db: Db, ator: Ator, f: FiltrosDemanda = {}) {
  exigir(ator, "dados:ver");
  const porPagina = 25;
  const pagina = Math.max(1, f.pagina ?? 1);
  const where = whereDemandas(ator, f);
  const [itens, total] = await Promise.all([
    db.demanda.findMany({
      where,
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true, protocolo: true, status: true, prioridade: true, prazo: true, dataEntrada: true, descricao: true,
        pessoa: { select: { nome: true } },
        tema: { select: { nome: true } },
        bairro: { select: { nome: true, regional: { select: { nome: true } } } },
        responsavel: { select: { id: true, nome: true } },
      },
    }),
    db.demanda.count({ where }),
  ]);
  return { itens, total, pagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function contadoresDemandas(db: Db, ator: Ator) {
  exigir(ator, "dados:ver");
  const c = (prazo?: FiltroPrazo, extra: FiltrosDemanda = {}) =>
    db.demanda.count({ where: whereDemandas(ator, { status: "abertas", prazo, ...extra }) });
  const [abertas, atrasadas, vence7, semResponsavel, minhas] = await Promise.all([
    c(), c("atrasadas"), c("7"), c(undefined, { responsavel: "sem" }), c(undefined, { responsavel: "eu" }),
  ]);
  return { abertas, atrasadas, vence7, semResponsavel, minhas };
}

export async function obterDemanda(db: Db, ator: Ator, id: string) {
  exigir(ator, "dados:ver");
  const d = await db.demanda.findUnique({
    where: { id },
    include: {
      pessoa: { include: { bairro: true } },
      tema: true,
      orgao: true,
      bairro: { include: { regional: true } },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
      historico: { orderBy: { data: "desc" }, include: { usuario: { select: { nome: true } } } },
      encaminhamentos: { orderBy: { criadoEm: "desc" }, include: { orgao: true, usuario: { select: { nome: true } } } },
    },
  });
  if (!d) throw naoEncontrado("Demanda não encontrada.");
  const verContato = podeVerContato(ator, d);
  if (!verContato) {
    d.pessoa.telefone = d.pessoa.telefone ? mascararTelefone(d.pessoa.telefone) : null;
    d.pessoa.email = d.pessoa.email ? mascararEmail(d.pessoa.email) : null;
  }
  return { ...d, podeEditar: podeEditarRegistro(ator, d), contatoVisivel: verContato };
}

export async function opcoesDemanda(db: Db) {
  const [temas, orgaos, regionais, responsaveis] = await Promise.all([
    db.tema.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.orgao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, sigla: true } }),
    db.regional.findMany({ orderBy: { nome: "asc" }, include: { bairros: { orderBy: { nome: "asc" }, select: { id: true, nome: true } } } }),
    db.usuario.findMany({ where: { ativo: true, perfil: { not: "CONSULTA" } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return { temas, orgaos, regionais, responsaveis };
}

// ---------- duplicidade ----------

export type Semelhantes = {
  pessoas: { id: string; nome: string; telefone: string | null; demandas: number }[];
  demandas: { id: string; protocolo: string; status: StatusDemanda; nome: string; bairro: string | null; descricao: string }[];
};

/** Procura pessoas e demandas parecidas antes do cadastro (nome, telefone, endereço, bairro, descrição). */
export async function buscarSemelhantes(
  db: Db,
  ator: Ator,
  e: { solicitanteNome?: string; telefone?: string | null; endereco?: string | null; bairroId?: string | number | null; descricao?: string },
): Promise<Semelhantes> {
  exigir(ator, "dados:ver");
  const nome = (e.solicitanteNome ?? "").trim();
  const digitos = (e.telefone ?? "").replace(/\D/g, "");
  const tel = digitos.length >= 8 ? digitos.slice(-8) : "";
  const endereco = (e.endereco ?? "").trim();
  const descricao = (e.descricao ?? "").trim();
  const bairroId = e.bairroId ? Number(e.bairroId) || null : null;

  const pessoas = await db.$queryRaw<{ id: string; nome: string; telefone: string | null; demandas: bigint }[]>`
    SELECT p.id, p.nome, p.telefone, (SELECT count(*) FROM demanda d WHERE d.pessoa_id = p.id) AS demandas
    FROM pessoa p
    WHERE (${tel} <> '' AND right(regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g'), 8) = ${tel})
       OR (${nome} <> '' AND similarity(p.nome, ${nome}) > 0.5)
    ORDER BY similarity(p.nome, ${nome}) DESC
    LIMIT 5`;

  const demandas = await db.$queryRaw<Semelhantes["demandas"]>`
    SELECT d.id, d.protocolo, d.status, p.nome, b.nome AS bairro, left(d.descricao, 160) AS descricao
    FROM demanda d
    JOIN pessoa p ON p.id = d.pessoa_id
    LEFT JOIN bairro b ON b.id = d.bairro_id
    WHERE (${tel} <> '' AND right(regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g'), 8) = ${tel})
       OR (${nome} <> '' AND similarity(p.nome, ${nome}) > 0.5)
       OR (${endereco} <> '' AND similarity(coalesce(d.endereco, ''), ${endereco}) > 0.5)
       OR (${descricao} <> '' AND d.bairro_id = ${bairroId}::int AND similarity(d.descricao, ${descricao}) > 0.3)
    ORDER BY d.criado_em DESC
    LIMIT 5`;

  const verTodos = pode(ator, "contatos:ver_todos");
  return {
    pessoas: pessoas.map((p) => ({ ...p, telefone: verTodos ? p.telefone : mascararTelefone(p.telefone) || null, demandas: Number(p.demandas) })),
    demandas,
  };
}

// ---------- escrita ----------

async function validarReferencias(
  db: Db | Tx,
  d: { temaId?: number | null; bairroId?: number | null; orgaoId?: number | null; responsavelId?: string | null },
) {
  if (d.temaId && !(await db.tema.findFirst({ where: { id: d.temaId, ativo: true } }))) throw validacao("Tema inválido.");
  if (d.bairroId && !(await db.bairro.findUnique({ where: { id: d.bairroId } }))) throw validacao("Bairro inválido.");
  if (d.orgaoId && !(await db.orgao.findFirst({ where: { id: d.orgaoId, ativo: true } }))) throw validacao("Órgão inválido.");
  if (d.responsavelId) {
    const r = await db.usuario.findUnique({ where: { id: d.responsavelId } });
    if (!r || !r.ativo || r.perfil === "CONSULTA") throw validacao("O responsável precisa ser um usuário ativo que pode editar demandas.");
  }
}

async function proximoProtocolo(tx: Tx) {
  const ano = Number(hojeISO().slice(0, 4));
  const [{ ultimo }] = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO protocolo_seq (ano, ultimo) VALUES (${ano}, 1)
    ON CONFLICT (ano) DO UPDATE SET ultimo = protocolo_seq.ultimo + 1
    RETURNING ultimo`;
  return `DEM-${ano}-${String(ultimo).padStart(5, "0")}`;
}

const dataConclusaoPara = (status: StatusDemanda) => (STATUS_FINAIS.includes(status) ? deISO(hojeISO()) : null);

export async function criarDemanda(db: Db, ator: Ator, entrada: DemandaCriar, meta: { ip?: string } = {}) {
  exigir(ator, "dados:criar");
  const r = demandaCriarSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const { solicitanteNome, telefone, email, pessoaId, status, ...campos } = r.data;
  await validarReferencias(db, campos);
  if (pessoaId) {
    const existente = await db.pessoa.findUnique({ where: { id: pessoaId } });
    if (!existente) throw validacao("Solicitante não encontrado.");
    if (!campos.endereco && !campos.bairroId) {
      campos.endereco = existente.endereco;
      campos.bairroId = existente.bairroId;
    }
  }

  return db.$transaction(async (tx) => {
    let idPessoa = pessoaId;
    if (!idPessoa) {
      const p = await tx.pessoa.create({
        data: { nome: solicitanteNome, telefone, email, endereco: campos.endereco, bairroId: campos.bairroId, criadoPorId: ator.id },
      });
      await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "pessoa", registroId: p.id, acao: "CRIAR", valorNovo: p, ip: meta.ip });
      idPessoa = p.id;
    }
    const st = status as StatusDemanda;
    const d = await tx.demanda.create({
      data: {
        ...campos,
        temaId: campos.temaId!,
        tipo: campos.tipo as TipoDemanda,
        prioridade: campos.prioridade as Prioridade,
        status: st,
        dataConclusao: dataConclusaoPara(st),
        protocolo: await proximoProtocolo(tx),
        pessoaId: idPessoa,
        criadoPorId: ator.id,
      },
    });
    await tx.demandaHistorico.create({
      data: { demandaId: d.id, usuarioId: ator.id, tipo: "CRIACAO", statusNovo: st, descricao: `Demanda cadastrada como "${ROTULO_STATUS[st]}".` },
    });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "demanda", registroId: d.id, acao: "CRIAR", valorNovo: d, ip: meta.ip });
    return d;
  });
}

async function carregarParaEditar(db: Db | Tx, ator: Ator, id: string) {
  const d = await db.demanda.findUnique({ where: { id }, include: { pessoa: true } });
  if (!d) throw naoEncontrado("Demanda não encontrada.");
  if (!podeEditarRegistro(ator, d)) throw proibir("Você só pode editar demandas sob sua responsabilidade ou criadas por você.");
  return d;
}

export async function atualizarDemanda(db: Db, ator: Ator, id: string, entrada: DemandaAtualizar, meta: { ip?: string } = {}) {
  const r = demandaAtualizarSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const { solicitanteNome, telefone, email, ...campos } = r.data;
  const atual = await carregarParaEditar(db, ator, id);
  await validarReferencias(db, campos);

  const antes = {
    endereco: atual.endereco, bairroId: atual.bairroId, temaId: atual.temaId, tipo: atual.tipo, descricao: atual.descricao,
    prioridade: atual.prioridade, prazo: atual.prazo, responsavelId: atual.responsavelId, orgaoId: atual.orgaoId, observacoes: atual.observacoes,
  };
  const dDemanda = diferenca(antes as Record<string, unknown>, campos);
  const dPessoa = diferenca(
    { nome: atual.pessoa.nome, telefone: atual.pessoa.telefone, email: atual.pessoa.email } as Record<string, unknown>,
    { nome: solicitanteNome, telefone, email },
  );
  if (!dDemanda.mudou && !dPessoa.mudou) return atual;

  return db.$transaction(async (tx) => {
    if (dPessoa.mudou) {
      await tx.pessoa.update({ where: { id: atual.pessoaId }, data: dPessoa.novo });
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "pessoa", registroId: atual.pessoaId, acao: "EDITAR",
        valorAnterior: dPessoa.anterior, valorNovo: dPessoa.novo, ip: meta.ip,
      });
    }
    const d = await tx.demanda.update({
      where: { id },
      data: { ...campos, temaId: campos.temaId!, tipo: campos.tipo as TipoDemanda, prioridade: campos.prioridade as Prioridade },
    });
    const alterados = [
      ...Object.keys(dDemanda.novo).filter((k) => k !== "responsavelId"),
      ...Object.keys(dPessoa.novo).map((k) => (k === "nome" ? "solicitanteNome" : k)),
    ];
    if (alterados.length) {
      await tx.demandaHistorico.create({
        data: { demandaId: id, usuarioId: ator.id, tipo: "EDICAO", descricao: `Alterou: ${alterados.map((k) => ROTULO_CAMPO[k] ?? k).join(", ")}.` },
      });
    }
    if ("responsavelId" in dDemanda.novo) {
      const nomes = await tx.usuario.findMany({ where: { id: { in: [atual.responsavelId, campos.responsavelId].filter(Boolean) as string[] } } });
      const n = (uid: string | null) => nomes.find((u) => u.id === uid)?.nome ?? "ninguém";
      await tx.demandaHistorico.create({
        data: { demandaId: id, usuarioId: ator.id, tipo: "RESPONSAVEL", descricao: `Responsável: ${n(atual.responsavelId)} → ${n(campos.responsavelId)}.` },
      });
    }
    if (dDemanda.mudou) {
      await registrarAuditoria(tx, {
        usuarioId: ator.id, entidade: "demanda", registroId: id, acao: "EDITAR",
        valorAnterior: dDemanda.anterior, valorNovo: dDemanda.novo, ip: meta.ip,
      });
    }
    return d;
  });
}

export async function alterarStatus(db: Db, ator: Ator, id: string, entrada: { status: string; comentario?: string | null }, meta: { ip?: string } = {}) {
  const r = statusSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const novo = r.data.status as StatusDemanda;
  const atual = await carregarParaEditar(db, ator, id);
  if (atual.status === novo) throw validacao("A demanda já está com esse status.");
  if ((novo === "CANCELADA" || novo === "NAO_RESOLVIDA") && !r.data.comentario) {
    throw validacao("Informe o motivo para cancelar ou marcar como não resolvida.");
  }
  return db.$transaction(async (tx) => {
    const dataConclusao = dataConclusaoPara(novo);
    const d = await tx.demanda.update({ where: { id }, data: { status: novo, dataConclusao } });
    await tx.demandaHistorico.create({
      data: {
        demandaId: id, usuarioId: ator.id, tipo: "STATUS", statusAnterior: atual.status, statusNovo: novo,
        descricao: `${ROTULO_STATUS[atual.status]} → ${ROTULO_STATUS[novo]}${r.data.comentario ? `: ${r.data.comentario}` : ""}`,
      },
    });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "demanda", registroId: id, acao: "EDITAR",
      valorAnterior: { status: atual.status, dataConclusao: atual.dataConclusao },
      valorNovo: { status: novo, dataConclusao }, descricao: r.data.comentario ?? undefined, ip: meta.ip,
    });
    return d;
  });
}

export async function comentarDemanda(db: Db, ator: Ator, id: string, texto: string) {
  const t = texto.trim();
  if (t.length < 2 || t.length > 2000) throw validacao("Escreva um comentário (até 2000 caracteres).");
  await carregarParaEditar(db, ator, id);
  return db.demandaHistorico.create({ data: { demandaId: id, usuarioId: ator.id, tipo: "COMENTARIO", descricao: t } });
}

export async function encaminharDemanda(db: Db, ator: Ator, id: string, entrada: Record<string, unknown>, meta: { ip?: string } = {}) {
  const r = encaminhamentoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const atual = await carregarParaEditar(db, ator, id);
  const orgao = await db.orgao.findFirst({ where: { id: r.data.orgaoId!, ativo: true } });
  if (!orgao) throw validacao("Órgão inválido.");

  return db.$transaction(async (tx) => {
    const e = await tx.encaminhamento.create({
      data: { demandaId: id, orgaoId: orgao.id, usuarioId: ator.id, protocolo: r.data.protocolo, descricao: r.data.descricao, prazoRetorno: r.data.prazoRetorno },
    });
    const mudaStatus = atual.status === "NOVA" || atual.status === "EM_ANALISE";
    await tx.demanda.update({
      where: { id },
      data: { ...(mudaStatus ? { status: "ENCAMINHADA" } : {}), ...(atual.orgaoId ? {} : { orgaoId: orgao.id }) },
    });
    await tx.demandaHistorico.create({
      data: {
        demandaId: id, usuarioId: ator.id, tipo: "ENCAMINHAMENTO",
        ...(mudaStatus ? { statusAnterior: atual.status, statusNovo: "ENCAMINHADA" as const } : {}),
        descricao: `Encaminhada para ${orgao.sigla ?? orgao.nome}${r.data.protocolo ? ` (protocolo ${r.data.protocolo})` : ""}: ${r.data.descricao}`,
      },
    });
    await registrarAuditoria(tx, { usuarioId: ator.id, entidade: "encaminhamento", registroId: e.id, acao: "CRIAR", valorNovo: e, ip: meta.ip });
    return e;
  });
}

export async function registrarRetorno(db: Db, ator: Ator, encaminhamentoId: string, entrada: Record<string, unknown>, meta: { ip?: string } = {}) {
  const r = retornoSchema.safeParse(entrada);
  if (!r.success) throw primeiroErro(r);
  const e = await db.encaminhamento.findUnique({ where: { id: encaminhamentoId }, include: { orgao: true } });
  if (!e) throw naoEncontrado("Encaminhamento não encontrado.");
  await carregarParaEditar(db, ator, e.demandaId);
  const dataRetorno = r.data.dataRetorno ?? deISO(hojeISO());
  return db.$transaction(async (tx) => {
    const n = await tx.encaminhamento.update({ where: { id: e.id }, data: { retorno: r.data.retorno, dataRetorno } });
    await tx.demandaHistorico.create({
      data: { demandaId: e.demandaId, usuarioId: ator.id, tipo: "RETORNO", descricao: `Retorno de ${e.orgao.sigla ?? e.orgao.nome}: ${r.data.retorno}` },
    });
    await registrarAuditoria(tx, {
      usuarioId: ator.id, entidade: "encaminhamento", registroId: e.id, acao: "EDITAR",
      valorAnterior: { retorno: e.retorno, dataRetorno: e.dataRetorno }, valorNovo: { retorno: n.retorno, dataRetorno: n.dataRetorno }, ip: meta.ip,
    });
    return n;
  });
}

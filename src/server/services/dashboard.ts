import { Prisma, type Esfera, type StatusDemanda, type StatusEmenda } from "@prisma/client";
import type { Db } from "@/server/db";
import { exigir, type Ator } from "@/server/authz";
import { ROTULO_STATUS, STATUS, STATUS_ABERTOS, STATUS_FINAIS, deISO, hojeISO, somarDias } from "@/lib/demandas";
import { ROTULO_STATUS_EMENDA, STATUS_EMENDA, centavos } from "@/lib/emendas";
import { ROTULO_ESFERA } from "@/lib/parlamentares";
import { DIAS_PRAZO_DEMANDA, inicioPeriodo, mesesEntre, percentual, rotuloMes, type Periodo } from "@/lib/dashboard";
import { WHERE_AGUARDANDO_RETORNO } from "@/server/services/demandas";
import { whereEmendaParada, whereEmendaPrazo } from "@/server/services/emendas";

export type FiltrosDashboard = { periodo: Periodo; ano?: number; minhas: boolean };
export type Fatia<K = string> = { chave: K | null; rotulo: string; valor: number };

const ESFERAS: Esfera[] = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];
const porValor = <T extends { valor: number }>(a: T, b: T) => b.valor - a.valor;

export async function anosEmendas(db: Db) {
  const r = await db.emenda.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } });
  return r.map((x) => x.ano);
}

export async function indicadoresDashboard(db: Db, ator: Ator, f: FiltrosDashboard, hoje = hojeISO()) {
  exigir(ator, "dados:ver");
  const desde = inicioPeriodo(f.periodo, hoje);
  const minhaD: Prisma.DemandaWhereInput = f.minhas ? { responsavelId: ator.id } : {};
  const wD: Prisma.DemandaWhereInput = { ...minhaD, ...(desde ? { dataEntrada: { gte: deISO(desde) } } : {}) };
  const wE: Prisma.EmendaWhereInput = { ...(f.ano ? { ano: f.ano } : {}), ...(f.minhas ? { responsavelId: ator.id } : {}) };
  const sqlMinhaD = f.minhas ? Prisma.sql`AND d.responsavel_id = ${ator.id}::uuid` : Prisma.empty;
  const sqlD = Prisma.sql`TRUE ${sqlMinhaD} ${desde ? Prisma.sql`AND d.data_entrada >= ${desde}::date` : Prisma.empty}`;
  const sqlE = Prisma.sql`TRUE ${f.ano ? Prisma.sql`AND e.ano = ${f.ano}` : Prisma.empty} ${f.minhas ? Prisma.sql`AND e.responsavel_id = ${ator.id}::uuid` : Prisma.empty}`;

  const [
    dStatus, dTema, dResp, dOrgao, dRegional, dEntradas, dConclusoes, dTempo, atrasadas,
    eStatus, eEsfera, eMandato,
  ] = await Promise.all([
    db.demanda.groupBy({ by: ["status"], where: wD, _count: { _all: true } }),
    db.demanda.groupBy({ by: ["temaId"], where: wD, _count: { _all: true } }),
    db.demanda.groupBy({ by: ["responsavelId"], where: wD, _count: { _all: true } }),
    db.demanda.groupBy({ by: ["orgaoId"], where: { ...wD, orgaoId: { not: null } }, _count: { _all: true } }),
    db.$queryRaw<{ id: number | null; nome: string | null; n: number }[]>`
      SELECT r.id, r.nome, count(*)::int AS n
      FROM demanda d LEFT JOIN bairro b ON b.id = d.bairro_id LEFT JOIN regional r ON r.id = b.regional_id
      WHERE ${sqlD} GROUP BY r.id, r.nome`,
    db.$queryRaw<{ m: string; n: number }[]>`
      SELECT to_char(d.data_entrada, 'YYYY-MM') AS m, count(*)::int AS n FROM demanda d WHERE ${sqlD} GROUP BY 1`,
    db.$queryRaw<{ m: string; n: number }[]>`
      SELECT to_char(d.data_conclusao, 'YYYY-MM') AS m, count(*)::int AS n FROM demanda d
      WHERE d.data_conclusao IS NOT NULL AND d.status::text IN (${Prisma.join(STATUS_FINAIS)}) ${sqlMinhaD}
        ${desde ? Prisma.sql`AND d.data_conclusao >= ${desde}::date` : Prisma.empty}
      GROUP BY 1`,
    db.$queryRaw<{ dias: number | null; n: number }[]>`
      SELECT avg(d.data_conclusao - d.data_entrada)::float AS dias, count(*)::int AS n FROM demanda d
      WHERE ${sqlD} AND d.status = 'RESOLVIDA' AND d.data_conclusao IS NOT NULL`,
    db.demanda.count({ where: { ...minhaD, status: { in: STATUS_ABERTOS }, prazo: { lt: deISO(hoje) } } }),
    db.emenda.groupBy({ by: ["status"], where: wE, _count: { _all: true } }),
    db.$queryRaw<{ esfera: Esfera; n: number; total: unknown; empenhado: unknown; liquidado: unknown; pago: unknown }[]>`
      SELECT e.esfera, count(*)::int AS n,
        coalesce(sum(coalesce(e.valor_aprovado, e.valor_indicado)) FILTER (WHERE e.status <> 'CANCELADA'), 0) AS total,
        coalesce(sum(e.valor_empenhado), 0) AS empenhado, coalesce(sum(e.valor_liquidado), 0) AS liquidado,
        coalesce(sum(e.valor_pago), 0) AS pago
      FROM emenda e WHERE ${sqlE} GROUP BY e.esfera`,
    db.$queryRaw<{ id: string; nome: string; autoria: number; outras: number }[]>`
      WITH v AS (
        SELECT p.id, p.nome, e.id AS emenda_id, bool_or(em.tipo IN ('AUTOR', 'COAUTOR')) AS autoria
        FROM emenda_mandato em
        JOIN mandato m ON m.id = em.mandato_id
        JOIN parlamentar p ON p.id = m.parlamentar_id
        JOIN emenda e ON e.id = em.emenda_id
        WHERE ${sqlE}
        GROUP BY p.id, p.nome, e.id
      )
      SELECT id::text, nome, count(*) FILTER (WHERE autoria)::int AS autoria, count(*) FILTER (WHERE NOT autoria)::int AS outras
      FROM v GROUP BY id, nome ORDER BY count(*) DESC, nome LIMIT 12`,
  ]);

  const ids = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);
  const [temas, usuarios, orgaos] = await Promise.all([
    db.tema.findMany({ where: { id: { in: ids(dTema.map((x) => x.temaId)) } }, select: { id: true, nome: true } }),
    db.usuario.findMany({ where: { id: { in: ids(dResp.map((x) => x.responsavelId)) } }, select: { id: true, nome: true } }),
    db.orgao.findMany({ where: { id: { in: ids(dOrgao.map((x) => x.orgaoId)) } }, select: { id: true, nome: true, sigla: true } }),
  ]);
  const nome = <K,>(lista: { id: K; nome: string }[], id: K) => lista.find((x) => x.id === id)?.nome ?? "—";

  const contaStatus = new Map(dStatus.map((x) => [x.status, x._count._all]));
  const n = (ss: StatusDemanda[]) => ss.reduce((t, s) => t + (contaStatus.get(s) ?? 0), 0);
  const total = n(STATUS);
  const concluidas = n(STATUS_FINAIS);

  const inicioMeses = desde ?? [...dEntradas, ...dConclusoes].map((x) => `${x.m}-01`).sort()[0] ?? hoje;
  const meses = mesesEntre(inicioMeses.slice(0, 7), hoje.slice(0, 7)).slice(-36).map((m) => ({
    mes: rotuloMes(m),
    novas: dEntradas.find((x) => x.m === m)?.n ?? 0,
    concluidas: dConclusoes.find((x) => x.m === m)?.n ?? 0,
  }));

  const esferas = ESFERAS.map((esfera) => {
    const r = eEsfera.find((x) => x.esfera === esfera);
    const c = (v: unknown) => centavos(v as { toString(): string } | null);
    return {
      chave: esfera, rotulo: ROTULO_ESFERA[esfera], n: r?.n ?? 0,
      total: c(r?.total), empenhado: c(r?.empenhado), liquidado: c(r?.liquidado), pago: c(r?.pago),
    };
  });
  const soma = (k: "n" | "total" | "empenhado" | "liquidado" | "pago") => esferas.reduce((t, e) => t + e[k], 0);
  const valorTotal = soma("total");
  const pago = soma("pago");

  return {
    demandas: {
      total,
      novas: n(["NOVA"]),
      emAndamento: n(STATUS_ABERTOS.filter((s) => s !== "NOVA")),
      concluidas,
      resolvidas: n(["RESOLVIDA"]),
      atrasadas,
      taxaConclusao: percentual(concluidas, total),
      tempoMedioDias: dTempo[0]?.dias === null || dTempo[0]?.dias === undefined ? null : Math.round(dTempo[0].dias),
      resolvidasComData: dTempo[0]?.n ?? 0,
      porStatus: STATUS.map((s): Fatia<StatusDemanda> => ({ chave: s, rotulo: ROTULO_STATUS[s], valor: contaStatus.get(s) ?? 0 })).filter((x) => x.valor),
      porTema: dTema.map((x): Fatia<number> => ({ chave: x.temaId, rotulo: nome(temas, x.temaId), valor: x._count._all })).sort(porValor),
      porRegional: dRegional.map((x): Fatia<number> => ({ chave: x.id, rotulo: x.nome ?? "Sem bairro/regional", valor: x.n })).sort(porValor),
      porResponsavel: dResp
        .map((x): Fatia<string> => ({ chave: x.responsavelId, rotulo: x.responsavelId ? nome(usuarios, x.responsavelId) : "Sem responsável", valor: x._count._all }))
        .sort(porValor),
      porOrgao: dOrgao
        .map((x): Fatia<number> => {
          const o = orgaos.find((y) => y.id === x.orgaoId);
          return { chave: x.orgaoId, rotulo: o?.sigla || o?.nome || "—", valor: x._count._all };
        })
        .sort(porValor)
        .slice(0, 12),
      porMes: meses,
    },
    emendas: {
      total: soma("n"),
      porEsferaQtd: esferas,
      valorTotal,
      empenhado: soma("empenhado"),
      liquidado: soma("liquidado"),
      pago,
      pendente: Math.max(0, valorTotal - pago),
      percentualExecucao: percentual(pago, valorTotal),
      porStatus: STATUS_EMENDA
        .map((s): Fatia<StatusEmenda> => ({ chave: s, rotulo: ROTULO_STATUS_EMENDA[s], valor: eStatus.find((x) => x.status === s)?._count._all ?? 0 }))
        .filter((x) => x.valor),
      porParlamentar: eMandato,
    },
  };
}

export type Indicadores = Awaited<ReturnType<typeof indicadoresDashboard>>;

const LIMITE = 6;

export async function pontosDeAtencao(db: Db, ator: Ator, minhas: boolean, hoje = hojeISO()) {
  exigir(ator, "dados:ver");
  const h = deISO(hoje);
  const minhaD: Prisma.DemandaWhereInput = minhas ? { responsavelId: ator.id } : {};
  const minhaE: Prisma.EmendaWhereInput = minhas ? { responsavelId: ator.id } : {};
  const abertas = { status: { in: STATUS_ABERTOS } };
  const selD = {
    id: true, protocolo: true, status: true, prazo: true,
    tema: { select: { nome: true } }, bairro: { select: { nome: true } }, responsavel: { select: { nome: true } },
  } satisfies Prisma.DemandaSelect;
  const selE = { id: true, codigo: true, objeto: true, status: true, prazo: true, esfera: true } satisfies Prisma.EmendaSelect;

  const demandas = async (where: Prisma.DemandaWhereInput, orderBy: Prisma.DemandaOrderByWithRelationInput[]) => {
    const w = { AND: [minhaD, where] };
    const [itens, total] = await Promise.all([db.demanda.findMany({ where: w, orderBy, take: LIMITE, select: selD }), db.demanda.count({ where: w })]);
    return { itens, total };
  };
  const emendas = async (where: Prisma.EmendaWhereInput, orderBy: Prisma.EmendaOrderByWithRelationInput[]) => {
    const w = { AND: [minhaE, where] };
    const [itens, total] = await Promise.all([
      db.emenda.findMany({
        where: w, orderBy, take: LIMITE,
        select: { ...selE, historico: { orderBy: { data: "desc" }, take: 1, select: { data: true } } },
      }),
      db.emenda.count({ where: w }),
    ]);
    return { itens, total };
  };

  const [atrasadas, vencendo, semResponsavel, aguardando, paradas, prazo, impedimento, agenda, agendaTotal] = await Promise.all([
    demandas({ ...abertas, prazo: { lt: h } }, [{ prazo: "asc" }]),
    demandas({ ...abertas, prazo: { gte: h, lte: deISO(somarDias(hoje, DIAS_PRAZO_DEMANDA)) } }, [{ prazo: "asc" }]),
    minhas ? Promise.resolve(null) : demandas({ ...abertas, responsavelId: null }, [{ dataEntrada: "asc" }]),
    demandas(WHERE_AGUARDANDO_RETORNO, [{ dataEntrada: "asc" }]),
    emendas(whereEmendaParada(hoje), [{ atualizadoEm: "asc" }]),
    emendas(whereEmendaPrazo(hoje), [{ prazo: "asc" }]),
    emendas({ status: "IMPEDIMENTO_TECNICO" }, [{ atualizadoEm: "asc" }]),
    db.compromisso.findMany({
      where: { status: "SOLICITADO", agendaVereador: true, fim: { gt: new Date() } },
      orderBy: { inicio: "asc" }, take: LIMITE, select: { id: true, titulo: true, inicio: true, fim: true },
    }),
    db.compromisso.count({ where: { status: "SOLICITADO", agendaVereador: true, fim: { gt: new Date() } } }),
  ]);
  return { atrasadas, vencendo, semResponsavel, aguardando, paradas, prazo, impedimento, agenda: { itens: agenda, total: agendaTotal } };
}

export type PontosDeAtencao = Awaited<ReturnType<typeof pontosDeAtencao>>;

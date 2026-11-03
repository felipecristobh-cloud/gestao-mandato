import { Prisma } from "@prisma/client";
import type { Db } from "@/server/db";
import { exigir, pode, type Ator } from "@/server/authz";
import { registrarAuditoria } from "@/server/audit";
import { validacao } from "@/server/errors";
import { ROTULO_STATUS, STATUS_ABERTOS, STATUS_FINAIS, hojeISO } from "@/lib/demandas";
import { ROTULO_STATUS_EMENDA } from "@/lib/emendas";
import { ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO } from "@/lib/parlamentares";
import { RELATORIOS, dataBR, type Coluna, type Formato, type Linha, type Relatorio, type TipoRelatorio } from "@/lib/relatorios";

export type FiltrosRelatorio = {
  de?: string;
  ate?: string;
  status?: string;
  regionalId?: string;
  temaId?: string;
  responsavel?: string; // "eu" | uuid
  esfera?: string;
  ano?: string;
  pessoais?: string; // "1" = incluir solicitante (só Admin/Coordenação)
};

const LIMITE_LINHAS = 10_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const NUM = /^\d+$/;
const ESFERAS = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];

const tem = (o: object, k?: string): k is string => !!k && Object.hasOwn(o, k);
const e_ = (xs: Prisma.Sql[]) => (xs.length ? Prisma.join(xs, " AND ") : Prisma.sql`TRUE`);

function whereDemandas(ator: Ator, f: FiltrosRelatorio, campoData: "entrada" | "conclusao") {
  const w: Prisma.Sql[] = [];
  const col = campoData === "entrada" ? Prisma.sql`d.data_entrada` : Prisma.sql`d.data_conclusao`;
  if (f.de && ISO.test(f.de)) w.push(Prisma.sql`${col} >= ${f.de}::date`);
  if (f.ate && ISO.test(f.ate)) w.push(Prisma.sql`${col} <= ${f.ate}::date`);
  if (f.status === "abertas") w.push(Prisma.sql`d.status::text IN (${Prisma.join(STATUS_ABERTOS)})`);
  else if (f.status === "concluidas") w.push(Prisma.sql`d.status::text IN (${Prisma.join(STATUS_FINAIS)})`);
  else if (tem(ROTULO_STATUS, f.status)) w.push(Prisma.sql`d.status::text = ${f.status}`);
  if (f.regionalId && NUM.test(f.regionalId)) w.push(Prisma.sql`b.regional_id = ${Number(f.regionalId)}`);
  if (f.temaId && NUM.test(f.temaId)) w.push(Prisma.sql`d.tema_id = ${Number(f.temaId)}`);
  if (f.responsavel === "eu") w.push(Prisma.sql`d.responsavel_id = ${ator.id}::uuid`);
  else if (f.responsavel && UUID.test(f.responsavel)) w.push(Prisma.sql`d.responsavel_id = ${f.responsavel}::uuid`);
  return w;
}

function whereEmendas(ator: Ator, f: FiltrosRelatorio) {
  const w: Prisma.Sql[] = [];
  if (f.esfera && ESFERAS.includes(f.esfera)) w.push(Prisma.sql`e.esfera::text = ${f.esfera}`);
  if (f.ano && /^\d{4}$/.test(f.ano)) w.push(Prisma.sql`e.ano = ${Number(f.ano)}`);
  if (f.status === "andamento") w.push(Prisma.sql`e.status NOT IN ('CONCLUIDA', 'CANCELADA')`);
  else if (tem(ROTULO_STATUS_EMENDA, f.status)) w.push(Prisma.sql`e.status::text = ${f.status}`);
  else if (f.status !== "todas") w.push(Prisma.sql`e.status <> 'CANCELADA'`);
  if (f.responsavel === "eu") w.push(Prisma.sql`e.responsavel_id = ${ator.id}::uuid`);
  else if (f.responsavel && UUID.test(f.responsavel)) w.push(Prisma.sql`e.responsavel_id = ${f.responsavel}::uuid`);
  return w;
}

async function descreverFiltros(db: Db, ator: Ator, f: FiltrosRelatorio, grupo: "demandas" | "emendas", campoData: string) {
  const out: string[] = [];
  const [regional, tema, resp] = await Promise.all([
    grupo === "demandas" && f.regionalId && NUM.test(f.regionalId) ? db.regional.findUnique({ where: { id: Number(f.regionalId) }, select: { nome: true } }) : null,
    grupo === "demandas" && f.temaId && NUM.test(f.temaId) ? db.tema.findUnique({ where: { id: Number(f.temaId) }, select: { nome: true } }) : null,
    f.responsavel === "eu" || (f.responsavel && UUID.test(f.responsavel))
      ? db.usuario.findUnique({ where: { id: f.responsavel === "eu" ? ator.id : f.responsavel }, select: { nome: true } })
      : null,
  ]);
  if (grupo === "demandas") {
    const de = f.de && ISO.test(f.de) ? dataBR(f.de) : null;
    const ate = f.ate && ISO.test(f.ate) ? dataBR(f.ate) : null;
    if (de || ate) out.push(`${campoData}: ${de ? `de ${de}` : ""}${de && ate ? " " : ""}${ate ? `até ${ate}` : ""}`);
    if (f.status === "abertas") out.push("Status: abertas");
    else if (f.status === "concluidas") out.push("Status: concluídas");
    else if (tem(ROTULO_STATUS, f.status)) out.push(`Status: ${ROTULO_STATUS[f.status as keyof typeof ROTULO_STATUS]}`);
    if (regional) out.push(`Regional: ${regional.nome}`);
    if (tema) out.push(`Tema: ${tema.nome}`);
  } else {
    if (f.esfera && ESFERAS.includes(f.esfera)) out.push(`Esfera: ${ROTULO_ESFERA[f.esfera as keyof typeof ROTULO_ESFERA]}`);
    if (f.ano && /^\d{4}$/.test(f.ano)) out.push(`Ano: ${f.ano}`);
    if (f.status === "andamento") out.push("Status: em andamento");
    else if (tem(ROTULO_STATUS_EMENDA, f.status)) out.push(`Status: ${ROTULO_STATUS_EMENDA[f.status as keyof typeof ROTULO_STATUS_EMENDA]}`);
    else if (f.status === "todas") out.push("Status: todos (inclui canceladas)");
    else out.push("Sem emendas canceladas");
  }
  if (resp) out.push(`Responsável: ${resp.nome}`);
  return out.length ? out : ["Sem filtros"];
}

// ---------- demandas ----------

const GRUPO_DEMANDA = {
  "demandas-regional": ["Regional", Prisma.sql`coalesce(r.nome, 'Sem bairro/regional')`],
  "demandas-bairro": ["Bairro", Prisma.sql`coalesce(b.nome || ' (' || r.nome || ')', 'Sem bairro')`],
  "demandas-tema": ["Tema", Prisma.sql`t.nome`],
  "demandas-assessor": ["Responsável", Prisma.sql`coalesce(u.nome, 'Sem responsável')`],
  "demandas-orgao": ["Órgão", Prisma.sql`coalesce(o.sigla || ' — ' || o.nome, o.nome, 'Não encaminhada')`],
} as const;

const JOIN_DEMANDA = Prisma.sql`
  FROM demanda d
  LEFT JOIN bairro b ON b.id = d.bairro_id LEFT JOIN regional r ON r.id = b.regional_id
  JOIN tema t ON t.id = d.tema_id LEFT JOIN usuario u ON u.id = d.responsavel_id LEFT JOIN orgao o ON o.id = d.orgao_id`;

async function demandasAgrupadas(db: Db, ator: Ator, tipo: keyof typeof GRUPO_DEMANDA, f: FiltrosRelatorio, hoje: string) {
  const [titulo, expr] = GRUPO_DEMANDA[tipo];
  const linhas = await db.$queryRaw<Linha[]>`
    SELECT ${expr} AS grupo, count(*)::int AS total,
      count(*) FILTER (WHERE d.status::text IN (${Prisma.join(STATUS_ABERTOS)}))::int AS abertas,
      count(*) FILTER (WHERE d.status::text IN (${Prisma.join(STATUS_ABERTOS)}) AND d.prazo < ${hoje}::date)::int AS atrasadas,
      count(*) FILTER (WHERE d.status::text IN (${Prisma.join(STATUS_FINAIS)}))::int AS concluidas,
      count(*) FILTER (WHERE d.status = 'RESOLVIDA')::int AS resolvidas,
      round(avg(d.data_conclusao - d.data_entrada) FILTER (WHERE d.status = 'RESOLVIDA' AND d.data_conclusao IS NOT NULL))::int AS tempo
    ${JOIN_DEMANDA}
    WHERE ${e_(whereDemandas(ator, f, "entrada"))}
    GROUP BY 1 ORDER BY 2 DESC, 1`;
  const colunas: Coluna[] = [
    { chave: "grupo", titulo, tipo: "texto", largura: 4 },
    { chave: "total", titulo: "Total", tipo: "inteiro", somar: true },
    { chave: "abertas", titulo: "Abertas", tipo: "inteiro", somar: true },
    { chave: "atrasadas", titulo: "Atrasadas", tipo: "inteiro", somar: true },
    { chave: "concluidas", titulo: "Concluídas", tipo: "inteiro", somar: true },
    { chave: "resolvidas", titulo: "Resolvidas", tipo: "inteiro", somar: true },
    { chave: "taxa", titulo: "% resolvidas", tipo: "percentual", razao: { num: "resolvidas", den: "total" } },
    { chave: "tempo", titulo: "Tempo médio (dias)", tipo: "inteiro" },
  ];
  return { colunas, linhas };
}

async function demandasLista(db: Db, ator: Ator, tipo: "demandas-atrasadas" | "demandas-resolvidas", f: FiltrosRelatorio, hoje: string, pessoais: boolean) {
  const atrasadas = tipo === "demandas-atrasadas";
  const cond = atrasadas
    ? Prisma.sql`d.status::text IN (${Prisma.join(STATUS_ABERTOS)}) AND d.prazo < ${hoje}::date`
    : Prisma.sql`d.status = 'RESOLVIDA'`;
  const rows = await db.$queryRaw<Linha[]>`
    SELECT d.protocolo, to_char(d.data_entrada, 'YYYY-MM-DD') AS entrada, to_char(d.prazo, 'YYYY-MM-DD') AS prazo,
      to_char(d.data_conclusao, 'YYYY-MM-DD') AS conclusao,
      ${atrasadas ? Prisma.sql`(${hoje}::date - d.prazo)` : Prisma.sql`(d.data_conclusao - d.data_entrada)`}::int AS dias,
      d.status::text AS status, t.nome AS tema, b.nome AS bairro, r.nome AS regional, u.nome AS responsavel,
      coalesce(o.sigla, o.nome) AS orgao
      ${pessoais ? Prisma.sql`, p.nome AS solicitante, p.telefone AS telefone` : Prisma.empty}
    ${JOIN_DEMANDA} ${pessoais ? Prisma.sql`JOIN pessoa p ON p.id = d.pessoa_id` : Prisma.empty}
    WHERE ${cond} AND ${e_(whereDemandas(ator, f, atrasadas ? "entrada" : "conclusao"))}
    ORDER BY ${atrasadas ? Prisma.sql`d.prazo ASC` : Prisma.sql`d.data_conclusao DESC NULLS LAST`}, d.protocolo
    LIMIT ${LIMITE_LINHAS}`;
  const linhas = rows.map((l) => ({ ...l, status: ROTULO_STATUS[l.status as keyof typeof ROTULO_STATUS] ?? l.status }));
  const colunas: Coluna[] = [
    { chave: "protocolo", titulo: "Protocolo", tipo: "texto", largura: 2.2 },
    { chave: "entrada", titulo: "Entrada", tipo: "data" },
    atrasadas ? { chave: "prazo", titulo: "Prazo", tipo: "data" } : { chave: "conclusao", titulo: "Conclusão", tipo: "data" },
    { chave: "dias", titulo: atrasadas ? "Dias de atraso" : "Dias até resolver", tipo: "inteiro" },
    { chave: "status", titulo: "Status", tipo: "texto", largura: 2 },
    { chave: "tema", titulo: "Tema", tipo: "texto", largura: 2.5 },
    { chave: "bairro", titulo: "Bairro", tipo: "texto", largura: 2 },
    { chave: "regional", titulo: "Regional", tipo: "texto", largura: 1.6 },
    { chave: "responsavel", titulo: "Responsável", tipo: "texto", largura: 2.2 },
    { chave: "orgao", titulo: "Órgão", tipo: "texto", largura: 1.4 },
    ...(pessoais
      ? ([{ chave: "solicitante", titulo: "Solicitante", tipo: "texto", largura: 2.5 }, { chave: "telefone", titulo: "Telefone", tipo: "texto", largura: 1.8 }] as Coluna[])
      : []),
  ];
  return { colunas, linhas };
}

// ---------- emendas ----------

const COLS_VALORES: Coluna[] = [
  { chave: "indicado", titulo: "Indicado", tipo: "moeda", somar: true },
  { chave: "base", titulo: "Aprovado (ou indicado)", tipo: "moeda", somar: true },
  { chave: "empenhado", titulo: "Empenhado", tipo: "moeda", somar: true },
  { chave: "liquidado", titulo: "Liquidado", tipo: "moeda", somar: true },
  { chave: "pago", titulo: "Pago", tipo: "moeda", somar: true },
  { chave: "apagar", titulo: "A pagar (empenhado − pago)", tipo: "moeda", somar: true },
  { chave: "execucao", titulo: "% pago", tipo: "percentual", razao: { num: "pago", den: "base" } },
];

const SOMAS_EMENDA = Prisma.sql`
  count(DISTINCT e.id)::int AS qtd,
  round(sum(e.valor_indicado) * 100)::float8 AS indicado,
  round(sum(coalesce(e.valor_aprovado, e.valor_indicado)) * 100)::float8 AS base,
  round(sum(e.valor_empenhado) * 100)::float8 AS empenhado,
  round(sum(e.valor_liquidado) * 100)::float8 AS liquidado,
  round(sum(e.valor_pago) * 100)::float8 AS pago,
  round(sum(e.valor_empenhado - e.valor_pago) * 100)::float8 AS apagar`;

const AUTORES = Prisma.sql`(
  SELECT em.emenda_id, p.nome FROM emenda_mandato em
  JOIN mandato m ON m.id = em.mandato_id JOIN parlamentar p ON p.id = m.parlamentar_id
  WHERE em.tipo IN ('AUTOR', 'COAUTOR') GROUP BY em.emenda_id, p.nome)`;

async function emendasAgrupadas(db: Db, ator: Ator, tipo: TipoRelatorio, f: FiltrosRelatorio) {
  const w = e_(whereEmendas(ator, f));
  let linhas: Linha[];
  let titulo: string;
  let extra: Coluna[] = [];
  let somavel = true;
  switch (tipo) {
    case "emendas-esfera":
      titulo = "Esfera";
      linhas = (await db.$queryRaw<Linha[]>`SELECT e.esfera::text AS grupo, ${SOMAS_EMENDA} FROM emenda e WHERE ${w} GROUP BY 1 ORDER BY 1`)
        .map((l) => ({ ...l, grupo: ROTULO_ESFERA[l.grupo as keyof typeof ROTULO_ESFERA] ?? l.grupo }));
      break;
    case "emendas-orgao":
      titulo = "Órgão";
      linhas = await db.$queryRaw<Linha[]>`
        SELECT coalesce(o.sigla || ' — ' || o.nome, o.nome, 'Sem órgão') AS grupo, ${SOMAS_EMENDA}
        FROM emenda e LEFT JOIN orgao o ON o.id = e.orgao_id WHERE ${w} GROUP BY 1 ORDER BY base DESC, 1`;
      break;
    case "emendas-beneficiario":
      titulo = "Beneficiário";
      linhas = await db.$queryRaw<Linha[]>`
        SELECT coalesce(en.nome, nullif(trim(e.beneficiario), ''), 'Não informado') AS grupo, ${SOMAS_EMENDA}
        FROM emenda e LEFT JOIN entidade en ON en.id = e.entidade_id WHERE ${w} GROUP BY 1 ORDER BY base DESC, 1`;
      break;
    case "emendas-parlamentar":
      titulo = "Parlamentar (autor/coautor)";
      somavel = false;
      linhas = await db.$queryRaw<Linha[]>`
        SELECT coalesce(a.nome, 'Autor não informado') AS grupo, ${SOMAS_EMENDA}
        FROM emenda e LEFT JOIN ${AUTORES} a ON a.emenda_id = e.id WHERE ${w} GROUP BY 1 ORDER BY base DESC, 1`;
      break;
    default: {
      titulo = "Mandato";
      somavel = false;
      const rows = await db.$queryRaw<(Linha & { cargo: string; ini: string; fim: string | null; part: string })[]>`
        SELECT p.nome AS grupo, m.cargo::text AS cargo, to_char(m.data_inicio, 'YYYY') AS ini, to_char(m.data_fim, 'YYYY') AS fim,
          em.tipo::text AS part, ${SOMAS_EMENDA}
        FROM emenda e JOIN emenda_mandato em ON em.emenda_id = e.id
        JOIN mandato m ON m.id = em.mandato_id JOIN parlamentar p ON p.id = m.parlamentar_id
        WHERE ${w} GROUP BY p.nome, m.id, m.cargo, m.data_inicio, m.data_fim, em.tipo ORDER BY p.nome, m.data_inicio, em.tipo`;
      linhas = rows.map(({ cargo, ini, fim, part, ...l }) => ({
        ...l,
        grupo: `${l.grupo} — ${ROTULO_CARGO[cargo as keyof typeof ROTULO_CARGO] ?? cargo} ${ini}–${fim ?? ""}`,
        participacao: ROTULO_PARTICIPACAO[part as keyof typeof ROTULO_PARTICIPACAO] ?? part,
      }));
      extra = [{ chave: "participacao", titulo: "Participação", tipo: "texto", largura: 1.8 }];
    }
  }
  const colunas: Coluna[] = [
    { chave: "grupo", titulo, tipo: "texto", largura: 4 },
    ...extra,
    { chave: "qtd", titulo: "Emendas", tipo: "inteiro", somar: somavel },
    ...COLS_VALORES.map((c) => ({ ...c, somar: c.somar && somavel })),
  ];
  const observacao = somavel ? undefined : "Uma emenda pode aparecer em mais de uma linha (coautoria ou várias participações), por isso não há linha de total.";
  return { colunas, linhas, observacao };
}

const CAMPO_VALOR = {
  "emendas-indicado": ["valor_indicado", "Valor indicado"],
  "emendas-empenhado": ["valor_empenhado", "Valor empenhado"],
  "emendas-liquidado": ["valor_liquidado", "Valor liquidado"],
  "emendas-pago": ["valor_pago", "Valor pago"],
} as const;

async function emendasLista(db: Db, ator: Ator, tipo: TipoRelatorio, f: FiltrosRelatorio) {
  const w = e_(whereEmendas(ator, f));
  const execucao = tipo === "emendas-execucao";
  const campo = execucao ? null : CAMPO_VALOR[tipo as keyof typeof CAMPO_VALOR];
  const rows = await db.$queryRaw<Linha[]>`
    SELECT e.codigo, e.numero, e.ano, e.esfera::text AS esfera, e.objeto, e.status::text AS status,
      coalesce(o.sigla, o.nome) AS orgao, coalesce(en.nome, nullif(trim(e.beneficiario), '')) AS beneficiario,
      (SELECT string_agg(a.nome, ', ' ORDER BY a.nome) FROM ${AUTORES} a WHERE a.emenda_id = e.id) AS autor,
      round(e.valor_indicado * 100)::float8 AS indicado,
      round(coalesce(e.valor_aprovado, e.valor_indicado) * 100)::float8 AS base,
      round(e.valor_empenhado * 100)::float8 AS empenhado,
      round(e.valor_liquidado * 100)::float8 AS liquidado,
      round(e.valor_pago * 100)::float8 AS pago,
      round((e.valor_empenhado - e.valor_pago) * 100)::float8 AS apagar
      ${campo ? Prisma.sql`, round(e.${Prisma.raw(campo[0])} * 100)::float8 AS valor` : Prisma.empty}
    FROM emenda e LEFT JOIN orgao o ON o.id = e.orgao_id LEFT JOIN entidade en ON en.id = e.entidade_id
    WHERE ${w} ${campo ? Prisma.sql`AND e.${Prisma.raw(campo[0])} > 0` : Prisma.empty}
    ORDER BY ${campo ? Prisma.sql`valor DESC,` : Prisma.empty} e.ano DESC, e.codigo
    LIMIT ${LIMITE_LINHAS}`;
  const linhas = rows.map((l) => ({
    ...l,
    esfera: ROTULO_ESFERA[l.esfera as keyof typeof ROTULO_ESFERA] ?? l.esfera,
    status: ROTULO_STATUS_EMENDA[l.status as keyof typeof ROTULO_STATUS_EMENDA] ?? l.status,
    autor: l.autor ?? "Não informado",
  }));
  const ident: Coluna[] = [
    { chave: "codigo", titulo: "Código", tipo: "texto", largura: 2 },
    { chave: "ano", titulo: "Ano", tipo: "inteiro", largura: 0.8 },
    { chave: "esfera", titulo: "Esfera", tipo: "texto", largura: 1.3 },
    { chave: "objeto", titulo: "Objeto", tipo: "texto", largura: 4 },
    { chave: "autor", titulo: "Autor", tipo: "texto", largura: 2.4 },
    { chave: "orgao", titulo: "Órgão", tipo: "texto", largura: 1.4 },
    { chave: "status", titulo: "Status", tipo: "texto", largura: 1.8 },
  ];
  const colunas: Coluna[] = campo
    ? [...ident, { chave: "beneficiario", titulo: "Beneficiário", tipo: "texto", largura: 2.6 }, { chave: "valor", titulo: campo[1], tipo: "moeda", somar: true, largura: 1.8 }]
    : [...ident, ...COLS_VALORES.map((c) => ({ ...c, largura: 1.6 }))];
  return { colunas, linhas };
}

// ---------- API ----------

export async function gerarRelatorio(
  db: Db, ator: Ator & { nome: string }, tipo: TipoRelatorio, f: FiltrosRelatorio, hoje = hojeISO(),
): Promise<Relatorio> {
  exigir(ator, "relatorios:exportar");
  const def = RELATORIOS[tipo];
  if (!def) throw validacao("Relatório inválido.");
  const pessoais = f.pessoais === "1" && pode(ator, "relatorios:exportar_com_dados_pessoais");
  let r: { colunas: Coluna[]; linhas: Linha[]; observacao?: string };
  if (tipo in GRUPO_DEMANDA) r = await demandasAgrupadas(db, ator, tipo as keyof typeof GRUPO_DEMANDA, f, hoje);
  else if (tipo === "demandas-atrasadas" || tipo === "demandas-resolvidas") r = await demandasLista(db, ator, tipo, f, hoje, pessoais);
  else if (tipo === "emendas-execucao" || tipo in CAMPO_VALOR) r = await emendasLista(db, ator, tipo, f);
  else r = await emendasAgrupadas(db, ator, tipo, f);

  const filtros = await descreverFiltros(db, ator, f, def.grupo, tipo === "demandas-resolvidas" ? "Conclusão" : "Entrada");
  if (pessoais && (tipo === "demandas-atrasadas" || tipo === "demandas-resolvidas")) filtros.push("Inclui dados pessoais do solicitante (uso restrito)");
  const observacoes = [r.observacao, r.linhas.length >= LIMITE_LINHAS ? `Limitado às primeiras ${LIMITE_LINHAS} linhas.` : undefined].filter(Boolean);
  return {
    titulo: def.titulo,
    filtros,
    observacao: observacoes.length ? observacoes.join(" ") : undefined,
    colunas: r.colunas,
    linhas: r.linhas,
    geradoEm: new Date(),
    geradoPor: ator.nome,
  };
}

export async function registrarExportacao(
  db: Db, ator: Ator, tipo: TipoRelatorio, formato: Formato, f: FiltrosRelatorio, r: Relatorio, ip?: string,
) {
  const pessoais = r.colunas.some((c) => c.chave === "solicitante");
  await registrarAuditoria(db, {
    usuarioId: ator.id,
    entidade: "relatorio",
    acao: "EXPORTAR",
    descricao: `${r.titulo} (${formato.toUpperCase()})${pessoais ? " com dados pessoais" : ""}`,
    valorNovo: { tipo, formato, filtros: f, linhas: r.linhas.length, dadosPessoais: pessoais },
    ip,
  });
}

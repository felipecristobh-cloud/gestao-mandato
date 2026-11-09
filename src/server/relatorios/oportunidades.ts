import type { EtapaOportunidade, Prisma } from "@prisma/client";
import type { Db } from "@/server/db";
import type { Ator } from "@/server/authz";
import type { Coluna, Linha } from "@/lib/relatorios";
import { ETAPAS_OPORTUNIDADE, ROTULO_ETAPA, ROTULO_PRIORIDADE_OPORTUNIDADE, prioridadeEfetiva } from "@/lib/oportunidades";
import {
  ROTULO_PARTICIPACAO_PROPOSICAO, ROTULO_TIPO_PROPOSICAO, ROTULO_VERIFICACAO, VERIFICACOES, rotuloProposicao,
} from "@/lib/proposicoes";
import { wherePainel } from "@/server/services/oportunidades-painel";

export type FiltrosOportunidadeRelatorio = { de?: string; ate?: string; eixoId?: string; etapa?: string; responsavel?: string; ano?: string; verificacao?: string };

const LIMITE = 10_000;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function carregar(db: Db, ator: Ator, f: FiltrosOportunidadeRelatorio) {
  return db.oportunidade.findMany({
    where: wherePainel(ator, { de: f.de, ate: f.ate, eixo: f.eixoId, etapa: f.etapa, responsavel: f.responsavel }),
    orderBy: [{ notaFinal: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
    take: LIMITE,
    select: {
      nome: true, etapa: true, notaFinal: true, prioridadeManual: true, criadoEm: true, demandaOrigemId: true,
      eixo: { select: { nome: true } }, responsavel: { select: { nome: true } },
      regionais: { select: { regional: { select: { nome: true } } } },
      bairros: { select: { bairro: { select: { regional: { select: { nome: true } } } } } },
    },
  });
}

type Op = Awaited<ReturnType<typeof carregar>>[number];
const regionaisDe = (o: Op) => [...new Set([...o.regionais.map((r) => r.regional.nome), ...o.bairros.map((b) => b.bairro.regional.nome)])];

const COLS_RESUMO: Coluna[] = [
  { chave: "total", titulo: "Propostas", tipo: "inteiro", somar: true, largura: 1 },
  { chave: "avaliadas", titulo: "Avaliadas", tipo: "inteiro", somar: true, largura: 1 },
  { chave: "somaNotas", titulo: "Soma das notas", tipo: "inteiro", somar: true, largura: 1 },
  { chave: "media", titulo: "Nota média", tipo: "percentual", razao: { num: "somaNotas", den: "avaliadas" }, largura: 1 },
  { chave: "lei", titulo: "Viraram lei", tipo: "inteiro", somar: true, largura: 1 },
];

function agrupar(ops: Op[], chaves: (o: Op) => string[], rotulo: string) {
  const m = new Map<string, Linha>();
  for (const o of ops) {
    for (const k of chaves(o)) {
      const l = m.get(k) ?? { grupo: k, total: 0, avaliadas: 0, somaNotas: 0, lei: 0 };
      l.total = Number(l.total) + 1;
      if (o.notaFinal !== null) { l.avaliadas = Number(l.avaliadas) + 1; l.somaNotas = Number(l.somaNotas) + o.notaFinal; }
      if (o.etapa === "LEI") l.lei = Number(l.lei) + 1;
      m.set(k, l);
    }
  }
  const linhas = [...m.values()].sort((a, b) => Number(b.total) - Number(a.total) || String(a.grupo).localeCompare(String(b.grupo), "pt-BR"));
  return { colunas: [{ chave: "grupo", titulo: rotulo, tipo: "texto", largura: 2.6 } as Coluna, ...COLS_RESUMO], linhas };
}

export async function relatorioOportunidades(
  db: Db, ator: Ator, tipo: "oportunidades-lista" | "oportunidades-eixo" | "oportunidades-regional" | "oportunidades-etapa" | "proposicoes-lista",
  f: FiltrosOportunidadeRelatorio,
): Promise<{ colunas: Coluna[]; linhas: Linha[]; observacao?: string }> {
  if (tipo === "proposicoes-lista") return proposicoes(db, f);
  const ops = await carregar(db, ator, f);
  const obs = "Nota média de 0 a 100. Nota alta não significa constitucionalidade: a análise jurídica é separada.";
  if (tipo === "oportunidades-eixo") return { ...agrupar(ops, (o) => [o.eixo.nome], "Eixo temático"), observacao: obs };
  if (tipo === "oportunidades-regional") {
    return { ...agrupar(ops, (o) => { const r = regionaisDe(o); return r.length ? r : ["Sem regional"]; }, "Regional"), observacao: `${obs} Uma proposta de várias regionais conta em cada uma.` };
  }
  if (tipo === "oportunidades-etapa") {
    const r = agrupar(ops, (o) => [o.etapa], "Etapa");
    const ordem = new Map(ETAPAS_OPORTUNIDADE.map((e, i) => [e, i]));
    r.linhas.sort((a, b) => (ordem.get(a.grupo as EtapaOportunidade) ?? 0) - (ordem.get(b.grupo as EtapaOportunidade) ?? 0));
    r.linhas.forEach((l) => { l.grupo = ROTULO_ETAPA[l.grupo as EtapaOportunidade]; });
    return { ...r, observacao: obs };
  }
  return {
    colunas: [
      { chave: "nome", titulo: "Proposta", tipo: "texto", largura: 3 },
      { chave: "eixo", titulo: "Eixo", tipo: "texto", largura: 1.6 },
      { chave: "regionais", titulo: "Regionais", tipo: "texto", largura: 1.8 },
      { chave: "etapa", titulo: "Etapa", tipo: "texto", largura: 1.6 },
      { chave: "nota", titulo: "Nota", tipo: "inteiro", largura: 0.7 },
      { chave: "prioridade", titulo: "Prioridade", tipo: "texto", largura: 1.2 },
      { chave: "responsavel", titulo: "Responsável", tipo: "texto", largura: 1.6 },
      { chave: "origem", titulo: "Origem", tipo: "texto", largura: 1 },
      { chave: "cadastro", titulo: "Cadastro", tipo: "data", largura: 1 },
    ],
    linhas: ops.map((o) => {
      const p = prioridadeEfetiva(o);
      return {
        nome: o.nome, eixo: o.eixo.nome, regionais: regionaisDe(o).join(", ") || null, etapa: ROTULO_ETAPA[o.etapa], nota: o.notaFinal,
        prioridade: p ? `${ROTULO_PRIORIDADE_OPORTUNIDADE[p]}${o.prioridadeManual ? " (manual)" : ""}` : "Sem avaliação",
        responsavel: o.responsavel?.nome ?? null, origem: o.demandaOrigemId ? "Demanda" : null, cadastro: iso(o.criadoEm),
      };
    }),
    observacao: obs,
  };
}

async function proposicoes(db: Db, f: FiltrosOportunidadeRelatorio) {
  const where: Prisma.ProposicaoWhereInput = {
    ...(f.ano && /^\d{4}$/.test(f.ano) ? { ano: Number(f.ano) } : {}),
    ...(f.eixoId && /^\d+$/.test(f.eixoId) ? { eixoId: Number(f.eixoId) } : {}),
    ...(f.verificacao && (VERIFICACOES as string[]).includes(f.verificacao) ? { verificacao: f.verificacao as (typeof VERIFICACOES)[number] } : {}),
  };
  const ps = await db.proposicao.findMany({ where, orderBy: [{ ano: "desc" }, { tipo: "asc" }, { numero: "desc" }], take: LIMITE, include: { eixo: { select: { nome: true } } } });
  return {
    colunas: [
      { chave: "proposicao", titulo: "Proposição", tipo: "texto", largura: 1.1 },
      { chave: "tipo", titulo: "Tipo", tipo: "texto", largura: 1.4 },
      { chave: "ementa", titulo: "Ementa", tipo: "texto", largura: 4 },
      { chave: "participacao", titulo: "Autoria", tipo: "texto", largura: 1.4 },
      { chave: "eixo", titulo: "Eixo", tipo: "texto", largura: 1.4 },
      { chave: "apresentacao", titulo: "Apresentação", tipo: "data", largura: 1 },
      { chave: "situacao", titulo: "Situação", tipo: "texto", largura: 1.4 },
      { chave: "lei", titulo: "Lei", tipo: "texto", largura: 1 },
      { chave: "verificacao", titulo: "Verificação", tipo: "texto", largura: 1.6 },
      { chave: "fonte", titulo: "Fonte", tipo: "texto", largura: 1.4 },
    ] satisfies Coluna[],
    linhas: ps.map((p) => ({
      proposicao: rotuloProposicao(p), tipo: ROTULO_TIPO_PROPOSICAO[p.tipo], ementa: p.ementa, participacao: ROTULO_PARTICIPACAO_PROPOSICAO[p.participacao],
      eixo: p.eixo?.nome ?? null, apresentacao: iso(p.dataApresentacao), situacao: p.situacao, lei: p.lei, verificacao: ROTULO_VERIFICACAO[p.verificacao], fonte: p.fonte,
    })),
    observacao: "Só registros cadastrados pela equipe. Confira a coluna Verificação antes de divulgar.",
  };
}

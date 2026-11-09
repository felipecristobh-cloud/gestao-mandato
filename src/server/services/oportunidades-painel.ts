import type { EtapaOportunidade, Prisma } from "@prisma/client";
import type { Db } from "@/server/db";
import { exigir, type Ator } from "@/server/authz";
import { ETAPAS_OPORTUNIDADE, INDICADORES_PAINEL, PRIORIDADES_OPORTUNIDADE, ROTULO_ETAPA, prioridadeEfetiva } from "@/lib/oportunidades";
import { MANDATOS_PEDRO, VERIFICACOES } from "@/lib/proposicoes";

export type FiltrosPainel = { de?: string; ate?: string; eixo?: string; responsavel?: string; etapa?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function wherePainel(ator: Ator, f: FiltrosPainel): Prisma.OportunidadeWhereInput {
  const e: Prisma.OportunidadeWhereInput[] = [];
  if (f.de && ISO.test(f.de)) e.push({ criadoEm: { gte: new Date(`${f.de}T00:00:00-03:00`) } });
  if (f.ate && ISO.test(f.ate)) e.push({ criadoEm: { lt: new Date(new Date(`${f.ate}T00:00:00-03:00`).getTime() + 86_400_000) } });
  if (f.eixo && /^\d+$/.test(f.eixo)) e.push({ eixoId: Number(f.eixo) });
  if (f.responsavel === "nenhum") e.push({ responsavelId: null });
  else if (f.responsavel === "eu") e.push({ responsavelId: ator.id });
  else if (f.responsavel && /^[0-9a-f-]{36}$/i.test(f.responsavel)) e.push({ responsavelId: f.responsavel });
  if (f.etapa && (ETAPAS_OPORTUNIDADE as string[]).includes(f.etapa)) e.push({ etapa: f.etapa as EtapaOportunidade });
  return e.length ? { AND: e } : {};
}

const contar = <K extends string>(chaves: K[]) => {
  const m = new Map<K, number>();
  for (const k of chaves) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
};

/** Indicadores calculados na hora (sem cache), com os mesmos filtros da tela. */
export async function painelOportunidades(db: Db, ator: Ator, f: FiltrosPainel = {}) {
  exigir(ator, "dados:ver");
  const [ops, porAno, porVerificacao] = await Promise.all([
    db.oportunidade.findMany({
      where: wherePainel(ator, f),
      select: {
        etapa: true, notaFinal: true, prioridadeManual: true, demandaOrigemId: true,
        eixo: { select: { nome: true } },
        regionais: { select: { regional: { select: { nome: true } } } },
        bairros: { select: { bairro: { select: { regional: { select: { nome: true } } } } } },
      },
    }),
    db.proposicao.groupBy({ by: ["ano"], _count: { _all: true } }),
    db.proposicao.groupBy({ by: ["verificacao"], _count: { _all: true } }),
  ]);
  const porEtapa = new Map(ETAPAS_OPORTUNIDADE.map((e) => [e, 0]));
  for (const o of ops) porEtapa.set(o.etapa, (porEtapa.get(o.etapa) ?? 0) + 1);
  const notas = ops.map((o) => o.notaFinal).filter((n): n is number => n !== null);
  const prioridades = ops.map((o) => prioridadeEfetiva(o));
  return {
    total: ops.length,
    indicadores: INDICADORES_PAINEL.map((i) => ({ ...i, valor: i.etapas.reduce((s, e) => s + (porEtapa.get(e) ?? 0), 0) })),
    arquivadas: (porEtapa.get("ARQUIVADA") ?? 0) + (porEtapa.get("SUSPENSA") ?? 0),
    deDemandas: ops.filter((o) => o.demandaOrigemId).length,
    mediaNota: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
    avaliadas: notas.length,
    porEtapa: ETAPAS_OPORTUNIDADE.map((e) => ({ etapa: e, rotulo: ROTULO_ETAPA[e], valor: porEtapa.get(e) ?? 0 })).filter((x) => x.valor > 0),
    porEixo: contar(ops.map((o) => o.eixo.nome)),
    porRegional: contar(ops.flatMap((o) => [...new Set([...o.regionais.map((r) => r.regional.nome), ...o.bairros.map((b) => b.bairro.regional.nome)])])),
    porPrioridade: PRIORIDADES_OPORTUNIDADE.map((p) => ({ prioridade: p, valor: prioridades.filter((x) => x === p).length })),
    semAvaliacao: prioridades.filter((x) => x === null).length,
    historico: {
      porMandato: MANDATOS_PEDRO.map((m) => ({ ...m, valor: porAno.filter((a) => a.ano >= m.inicio && a.ano <= m.fim).reduce((s, a) => s + a._count._all, 0) })),
      porVerificacao: VERIFICACOES.map((v) => ({ verificacao: v, valor: porVerificacao.find((x) => x.verificacao === v)?._count._all ?? 0 })),
    },
  };
}

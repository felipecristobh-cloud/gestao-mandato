import type { Prisma, StatusDemanda } from "@prisma/client";
import type { Db } from "@/server/db";
import { exigir, podeVerContato, type Ator } from "@/server/authz";
import { ROTULO_STATUS, STATUS_ABERTOS, STATUS_FINAIS, deISO, hojeISO } from "@/lib/demandas";
import { dentroDeBH, type PontoMapa } from "@/lib/mapa";

export type FiltrosMapa = { regionalId?: string; bairroId?: string; temaId?: string; status?: string; de?: string; ate?: string };

export const LIMITE_PONTOS = 5000;
const NUM = /^\d+$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function whereMapa(f: FiltrosMapa): Prisma.DemandaWhereInput {
  const e: Prisma.DemandaWhereInput[] = [];
  if (f.status === "abertas") e.push({ status: { in: STATUS_ABERTOS } });
  else if (f.status === "concluidas") e.push({ status: { in: STATUS_FINAIS } });
  else if (f.status && Object.hasOwn(ROTULO_STATUS, f.status)) e.push({ status: f.status as StatusDemanda });
  if (f.temaId && NUM.test(f.temaId)) e.push({ temaId: Number(f.temaId) });
  if (f.bairroId && NUM.test(f.bairroId)) e.push({ bairroId: Number(f.bairroId) });
  if (f.regionalId && NUM.test(f.regionalId)) e.push({ bairro: { regionalId: Number(f.regionalId) } });
  if (f.de && ISO.test(f.de)) e.push({ dataEntrada: { gte: deISO(f.de) } });
  if (f.ate && ISO.test(f.ate)) e.push({ dataEntrada: { lte: deISO(f.ate) } });
  return e.length ? { AND: e } : {};
}

/**
 * Pontos do mapa. Localização exata só para quem pode ver o contato do solicitante
 * (mesma regra do telefone); os demais veem o ponto no centro do bairro.
 */
export async function dadosMapa(db: Db, ator: Ator, f: FiltrosMapa, hoje = hojeISO()) {
  exigir(ator, "dados:ver");
  const ds = await db.demanda.findMany({
    where: whereMapa(f),
    orderBy: { dataEntrada: "desc" },
    take: LIMITE_PONTOS,
    select: {
      id: true, protocolo: true, status: true, prazo: true, dataEntrada: true, latitude: true, longitude: true,
      responsavelId: true, criadoPorId: true, bairroId: true,
      tema: { select: { nome: true } },
      bairro: { select: { nome: true, latitude: true, longitude: true, regional: { select: { nome: true } } } },
    },
  });

  const pontos: PontoMapa[] = [];
  const noCentro = new Map<number, number>();
  const regionais = new Map<string, { nome: string; total: number; atrasadas: number }>();
  let semLocalizacao = 0;
  let exatas = 0;

  for (const d of ds) {
    const atrasada = STATUS_ABERTOS.includes(d.status) && !!d.prazo && iso(d.prazo)! < hoje;
    const reg = d.bairro?.regional.nome ?? "Sem bairro";
    const r = regionais.get(reg) ?? { nome: reg, total: 0, atrasadas: 0 };
    r.total++;
    if (atrasada) r.atrasadas++;
    regionais.set(reg, r);

    let lat: number | null = null;
    let lng: number | null = null;
    let aproximado = true;
    if (d.latitude != null && d.longitude != null && dentroDeBH(d.latitude, d.longitude) && podeVerContato(ator, d)) {
      [lat, lng, aproximado] = [d.latitude, d.longitude, false];
      exatas++;
    } else if (d.bairroId && d.bairro?.latitude != null && d.bairro.longitude != null) {
      // espalha os pontos do mesmo bairro numa espiral pequena (~100 m) para não ficarem sobrepostos
      const i = noCentro.get(d.bairroId) ?? 0;
      noCentro.set(d.bairroId, i + 1);
      const raio = i === 0 ? 0 : 0.0009 * Math.sqrt(i);
      lat = d.bairro.latitude + raio * Math.sin(i * 2.4);
      lng = d.bairro.longitude + raio * Math.cos(i * 2.4);
    }
    if (lat === null || lng === null) {
      semLocalizacao++;
      continue;
    }
    pontos.push({
      id: d.id, protocolo: d.protocolo, lat, lng, aproximado, status: d.status, atrasada,
      tema: d.tema.nome, bairro: d.bairro?.nome ?? null, regional: d.bairro?.regional.nome ?? null,
      entrada: iso(d.dataEntrada)!, prazo: iso(d.prazo),
    });
  }

  return {
    pontos,
    total: ds.length,
    exatas,
    semLocalizacao,
    limitado: ds.length >= LIMITE_PONTOS,
    porRegional: [...regionais.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)),
  };
}

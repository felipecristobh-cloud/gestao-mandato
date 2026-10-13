import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { alterarStatus, atualizarDemanda, criarDemanda } from "@/server/services/demandas";
import { dadosMapa } from "@/server/services/mapa";
import { hojeISO, somarDias } from "@/lib/demandas";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };
let base: Awaited<ReturnType<typeof criarBase>>;
let coord: Ator;
let assessor: Ator;
let consulta: Ator;
const hoje = hojeISO();

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  coord = await criarUsuarioTeste("COORDENACAO");
  assessor = await criarUsuarioTeste("ASSESSOR");
  consulta = await criarUsuarioTeste("CONSULTA");
  await db.bairro.update({ where: { id: base.bairro.id }, data: { latitude: -19.915, longitude: -43.917 } });
});

const demanda = (extra: Record<string, unknown> = {}) => ({
  solicitanteNome: "Pessoa Fictícia Mapa", bairroId: String(base.bairro.id), temaId: String(base.tema.id),
  descricao: "Descrição fictícia para o mapa", ...extra,
});

describe("mapa — pontos", () => {
  it("ponto exato só para quem vê o contato; demais no centro do bairro", async () => {
    const d1 = await criarDemanda(db, coord, demanda({ latitude: "-19.9101", longitude: "-43.9202", prazo: somarDias(hoje, -1) }));
    await criarDemanda(db, coord, demanda());
    await criarDemanda(db, coord, demanda());
    await criarDemanda(db, coord, demanda({ bairroId: String(base.bairroOeste.id) }));
    await criarDemanda(db, assessor, demanda({ latitude: "-19.9", longitude: "-43.93" }));

    const c = await dadosMapa(db, coord, {}, hoje);
    expect(c).toMatchObject({ total: 5, exatas: 2, semLocalizacao: 1 });
    expect(c.pontos.find((p) => p.id === d1.id)).toMatchObject({ lat: -19.9101, lng: -43.9202, aproximado: false, atrasada: true });
    const centro = c.pontos.filter((p) => p.aproximado);
    expect(centro).toHaveLength(2);
    expect(new Set(centro.map((p) => `${p.lat},${p.lng}`)).size).toBe(2); // espalhados, não sobrepostos
    expect(centro.every((p) => Math.abs(p.lat + 19.915) < 0.002)).toBe(true);

    const q = await dadosMapa(db, consulta, {}, hoje);
    expect(q.exatas).toBe(0);
    expect(q.pontos.find((p) => p.id === d1.id)).toMatchObject({ aproximado: true });
    expect(JSON.stringify(q)).not.toContain("-19.9101");

    const a = await dadosMapa(db, assessor, {}, hoje);
    expect(a.exatas).toBe(1); // só a que ele criou
    expect(c.porRegional[0]).toMatchObject({ nome: base.regional.nome, total: 4, atrasadas: 1 });
  });

  it("filtros e validação da localização", async () => {
    const d = await criarDemanda(db, coord, demanda());
    await criarDemanda(db, coord, demanda({ bairroId: String(base.bairroOeste.id) }));
    await alterarStatus(db, coord, d.id, { status: "RESOLVIDA" });
    expect((await dadosMapa(db, coord, { status: "concluidas" }, hoje)).total).toBe(1);
    expect((await dadosMapa(db, coord, { regionalId: String(base.regional.id) }, hoje)).total).toBe(1);
    expect((await dadosMapa(db, coord, { temaId: String(base.tema.id), de: somarDias(hoje, 1) }, hoje)).total).toBe(0);
    expect((await dadosMapa(db, coord, { status: "__proto__" }, hoje)).total).toBe(2);

    await expect(criarDemanda(db, coord, demanda({ latitude: "-19.9" }))).rejects.toThrow(/incompleta/);
    await expect(criarDemanda(db, coord, demanda({ latitude: "-23.5", longitude: "-46.6" }))).rejects.toThrow(/fora de Belo Horizonte/);
    await atualizarDemanda(db, coord, d.id, { ...demanda(), latitude: "-19.91", longitude: "-43.92" });
    expect(await db.demanda.findUnique({ where: { id: d.id }, select: { latitude: true, longitude: true } })).toEqual({ latitude: -19.91, longitude: -43.92 });
    const hist = await db.demandaHistorico.findFirst({ where: { demandaId: d.id, tipo: "EDICAO" } });
    expect(hist?.descricao).toMatch(/latitude/);
  });
});

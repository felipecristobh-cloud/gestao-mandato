import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { alterarStatus, criarDemanda, encaminharDemanda } from "@/server/services/demandas";
import { alterarStatusEmenda, criarEmenda, registrarLancamento, vincularMandatoEmenda } from "@/server/services/emendas";
import { criarMandato, criarParlamentar } from "@/server/services/parlamentares";
import { indicadoresDashboard, pontosDeAtencao } from "@/server/services/dashboard";
import { listarDemandas } from "@/server/services/demandas";
import { listarEmendas } from "@/server/services/emendas";
import { deISO, hojeISO, somarDias } from "@/lib/demandas";

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
});

const demanda = (extra: Record<string, unknown> = {}) => ({
  solicitanteNome: `Pessoa Fictícia ${Math.random().toString(36).slice(2, 8)}`,
  endereco: "Rua Fictícia, 10",
  bairroId: String(base.bairro.id),
  temaId: String(base.tema.id),
  tipo: "SOLICITACAO",
  prioridade: "MEDIA",
  descricao: "Descrição fictícia de demanda para o dashboard",
  ...extra,
});

const emenda = (extra: Record<string, unknown> = {}) => ({
  esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", objeto: "Objeto fictício de emenda", valorIndicado: "1.000,00", ...extra,
});

const f = { periodo: "tudo" as const, minhas: false };

describe("dashboard — indicadores", () => {
  it("conta demandas por status, regional, tema, responsável e órgão; tempo médio e taxa", async () => {
    const d1 = await criarDemanda(db, coord, demanda({ responsavelId: assessor.id }));
    const d2 = await criarDemanda(db, coord, demanda({ bairroId: String(base.bairroOeste.id), prazo: somarDias(hoje, -3) }));
    await criarDemanda(db, coord, demanda({ bairroId: "" }));
    await encaminharDemanda(db, coord, d2.id, { orgaoId: String(base.orgao.id), descricao: "Ofício fictício ao órgão" });
    await alterarStatus(db, coord, d1.id, { status: "RESOLVIDA" });
    await db.demanda.update({ where: { id: d1.id }, data: { dataEntrada: deISO(somarDias(hoje, -10)), dataConclusao: deISO(hoje) } });

    const r = await indicadoresDashboard(db, consulta, f, hoje);
    expect(r.demandas.total).toBe(3);
    expect(r.demandas.concluidas).toBe(1);
    expect(r.demandas.novas + r.demandas.emAndamento).toBe(2);
    expect(r.demandas.taxaConclusao).toBe(33.3);
    expect(r.demandas.tempoMedioDias).toBe(10);
    expect(r.demandas.atrasadas).toBe(1);
    expect(r.demandas.porRegional.map((x) => x.valor).sort()).toEqual([1, 1, 1]);
    expect(r.demandas.porRegional.find((x) => x.chave === null)?.rotulo).toBe("Sem bairro/regional");
    expect(r.demandas.porTema).toEqual([{ chave: base.tema.id, rotulo: base.tema.nome, valor: 3 }]);
    expect(r.demandas.porResponsavel.find((x) => x.chave === assessor.id)?.valor).toBe(1);
    expect(r.demandas.porOrgao).toEqual([{ chave: base.orgao.id, rotulo: "SMOBI", valor: 1 }]);
    expect(r.demandas.porMes.reduce((t, m) => t + m.novas, 0)).toBe(3);
    expect(r.demandas.porMes.reduce((t, m) => t + m.concluidas, 0)).toBe(1);
    expect(r.demandas.porMes.at(-1)?.concluidas).toBe(1);

    const minhas = await indicadoresDashboard(db, assessor, { ...f, minhas: true }, hoje);
    expect(minhas.demandas.total).toBe(1);

    const doze = await indicadoresDashboard(db, coord, { ...f, periodo: "12m" }, hoje);
    await db.demanda.update({ where: { id: d2.id }, data: { dataEntrada: deISO(somarDias(hoje, -800)) } });
    const doze2 = await indicadoresDashboard(db, coord, { ...f, periodo: "12m" }, hoje);
    expect(doze2.demandas.total).toBe(doze.demandas.total - 1);
    expect(doze2.demandas.atrasadas).toBe(1);
    expect((await listarDemandas(db, coord, { entradaDe: somarDias(hoje, -365) })).total).toBe(2);
    expect((await listarDemandas(db, coord, { orgaoId: String(base.orgao.id) })).total).toBe(1);
  });

  it("valores e execução de emendas; canceladas fora do valor total; autoria só explícita", async () => {
    const e1 = await criarEmenda(db, coord, emenda({ numero: "1", valorAprovado: "800,00" }));
    const e2 = await criarEmenda(db, coord, emenda({ numero: "2", esfera: "FEDERAL" }));
    const e3 = await criarEmenda(db, coord, emenda({ numero: "3" }));
    await registrarLancamento(db, coord, e1.id, { tipo: "EMPENHO", valor: "800,00", data: hoje });
    await registrarLancamento(db, coord, e1.id, { tipo: "LIQUIDACAO", valor: "400,00", data: hoje });
    await registrarLancamento(db, coord, e1.id, { tipo: "PAGAMENTO", valor: "200,00", data: hoje });
    await alterarStatusEmenda(db, coord, e3.id, { status: "CANCELADA", comentario: "Cancelada no teste" });

    const p = await criarParlamentar(db, coord, { nome: "Deputada Fictícia", cargo: "DEPUTADO_FEDERAL", partido: "X" });
    const m = await criarMandato(db, coord, p.id, { cargo: "DEPUTADO_FEDERAL", dataInicio: "2023-02-01", dataFim: "2027-01-31" });
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: m.id, tipo: "AUTOR" });
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: m.id, tipo: "ARTICULADOR" });
    const v = await criarParlamentar(db, coord, { nome: "Vereador Parceiro Fictício", cargo: "VEREADOR" });
    const mv = await criarMandato(db, coord, v.id, { cargo: "VEREADOR", dataInicio: "2025-01-01", dataFim: "2028-12-31" });
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: mv.id, tipo: "ACOMPANHAMENTO" });

    const r = await indicadoresDashboard(db, consulta, f, hoje);
    expect(r.emendas.total).toBe(3);
    expect(r.emendas.porEsferaQtd.map((x) => x.n)).toEqual([2, 0, 1]);
    expect(r.emendas.valorTotal).toBe(180000);
    expect(r.emendas.empenhado).toBe(80000);
    expect(r.emendas.liquidado).toBe(40000);
    expect(r.emendas.pago).toBe(20000);
    expect(r.emendas.pendente).toBe(160000);
    expect(r.emendas.percentualExecucao).toBe(11.1);
    expect(r.emendas.porStatus.find((x) => x.chave === "CANCELADA")?.valor).toBe(1);
    expect(r.emendas.porParlamentar).toEqual(expect.arrayContaining([
      { id: p.id, nome: p.nome, autoria: 1, outras: 0 },
      { id: v.id, nome: v.nome, autoria: 0, outras: 1 },
    ]));
    expect((await indicadoresDashboard(db, coord, { ...f, ano: 2025 }, hoje)).emendas.total).toBe(0);
  });
});

describe("dashboard — pontos de atenção", () => {
  it("demandas atrasadas, vencendo, sem responsável e aguardando retorno", async () => {
    await criarDemanda(db, coord, demanda({ prazo: somarDias(hoje, -1), responsavelId: assessor.id }));
    await criarDemanda(db, coord, demanda({ prazo: somarDias(hoje, 5) }));
    const d3 = await criarDemanda(db, coord, demanda({ responsavelId: assessor.id }));
    await encaminharDemanda(db, coord, d3.id, { orgaoId: String(base.orgao.id), descricao: "Ofício fictício ao órgão" });

    const p = await pontosDeAtencao(db, consulta, false, hoje);
    expect(p.atrasadas.total).toBe(1);
    expect(p.vencendo.total).toBe(1);
    expect(p.semResponsavel?.total).toBe(1);
    expect(p.aguardando.total).toBe(1);
    expect(p.aguardando.itens[0]).not.toHaveProperty("pessoa");
    expect((await listarDemandas(db, coord, { retorno: "pendente" })).total).toBe(1);

    const minhas = await pontosDeAtencao(db, assessor, true, hoje);
    expect(minhas.semResponsavel).toBeNull();
    expect(minhas.atrasadas.total).toBe(1);
    expect(minhas.vencendo.total).toBe(0);
  });

  it("emendas paradas, com prazo próximo e com impedimento técnico", async () => {
    const parada = await criarEmenda(db, coord, emenda({ numero: "10" }));
    const nova = await criarEmenda(db, coord, emenda({ numero: "11", prazo: somarDias(hoje, 10) }));
    const imp = await criarEmenda(db, coord, emenda({ numero: "12", prazo: somarDias(hoje, 90) }));
    await alterarStatusEmenda(db, coord, imp.id, { status: "IMPEDIMENTO_TECNICO", comentario: "Plano de trabalho fictício incompleto" });
    const antigo = new Date(Date.now() - 90 * 86_400_000);
    await db.emenda.update({ where: { id: parada.id }, data: { criadoEm: antigo } });
    await db.emendaHistorico.updateMany({ where: { emendaId: parada.id }, data: { data: antigo } });

    const p = await pontosDeAtencao(db, coord, false, hoje);
    expect(p.paradas.itens.map((x) => x.id)).toEqual([parada.id]);
    expect(p.prazo.itens.map((x) => x.id)).toEqual([nova.id]);
    expect(p.impedimento.itens.map((x) => x.id)).toEqual([imp.id]);
    expect((await listarEmendas(db, coord, { alerta: "parada" })).total).toBe(1);
    expect((await listarEmendas(db, coord, { alerta: "prazo" })).total).toBe(1);

    await registrarLancamento(db, coord, parada.id, { tipo: "EMPENHO", valor: "10,00", data: hoje });
    expect((await pontosDeAtencao(db, coord, false, hoje)).paradas.total).toBe(0);
  });
});

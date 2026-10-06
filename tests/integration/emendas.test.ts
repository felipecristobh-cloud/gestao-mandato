import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  adicionarDocumento, alterarStatusEmenda, atualizarEmenda, criarEmenda, desvincularMandatoEmenda, excluirLancamento, listarEmendas,
  obterEmenda, redeMandatos, registrarLancamento, vincularMandatoEmenda,
} from "@/server/services/emendas";
import { criarMandato, criarParlamentar, excluirMandato, obterParlamentar } from "@/server/services/parlamentares";
import { completarCnpj } from "@/lib/emendas";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };

let base: Awaited<ReturnType<typeof criarBase>>;
let coord: Ator;
let proprio: { id: string };
let estadual: { id: string };
let federal: { id: string };
let antigo: { id: string };

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  coord = await criarUsuarioTeste("COORDENACAO");
  const pedro = await criarParlamentar(db, coord, { nome: "Titular Fictício", cargo: "VEREADOR", proprio: "on" });
  proprio = await criarMandato(db, coord, pedro.id, { cargo: "VEREADOR", dataInicio: "2025-01-01", dataFim: "2028-12-31" });
  antigo = await criarMandato(db, coord, pedro.id, { cargo: "VEREADOR", dataInicio: "2017-01-01", dataFim: "2020-12-31" });
  const dep = await criarParlamentar(db, coord, { nome: "Deputada Fictícia", cargo: "DEPUTADO_ESTADUAL" });
  estadual = await criarMandato(db, coord, dep.id, { cargo: "DEPUTADO_ESTADUAL", dataInicio: "2023-02-01", dataFim: "2027-01-31" });
  const fed = await criarParlamentar(db, coord, { nome: "Deputado Federal Fictício", cargo: "DEPUTADO_FEDERAL" });
  federal = await criarMandato(db, coord, fed.id, { cargo: "DEPUTADO_FEDERAL", dataInicio: "2023-02-01", dataFim: "2027-01-31" });
});

async function erroDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AppError).code;
  }
  return "SEM_ERRO";
}

const CNPJ = completarCnpj("112223330001");
const dados = (extra: Record<string, unknown> = {}) => ({
  esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", numero: "101", objeto: "Reforma fictícia de quadra comunitária",
  valorIndicado: "150.000,00", valorAprovado: "100.000,00", beneficiario: "Associação Fictícia", cnpj: CNPJ, orgaoId: String(base.orgao.id), ...extra,
});

describe("emendas — cadastro, edição e permissões", () => {
  it("cria com código, valores em centavos, histórico e auditoria", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(e.codigo).toMatch(/^EME-\d{4}-00001$/);
    const o = await obterEmenda(db, coord, e.id);
    expect(o.valores).toEqual({ indicado: 15_000_000, aprovado: 10_000_000, empenhado: 0, liquidado: 0, pago: 0 });
    expect(o.status).toBe("EM_NEGOCIACAO");
    expect(o.autor).toBeNull();
    expect(o.historico.map((h) => h.tipo)).toEqual(["CRIACAO"]);
    expect(await db.auditLog.count({ where: { entidade: "emenda", registroId: e.id, acao: "CRIAR" } })).toBe(1);
    const e2 = await criarEmenda(db, coord, dados({ numero: "102" }));
    expect(e2.codigo).toMatch(/-00002$/);
  });

  it("rejeita valores inválidos, CNPJ inválido, número repetido e Consulta", async () => {
    expect(await erroDe(criarEmenda(db, coord, dados({ valorIndicado: "abc" })))).toBe("VALIDACAO");
    expect(await erroDe(criarEmenda(db, coord, dados({ valorIndicado: "0" })))).toBe("VALIDACAO");
    expect(await erroDe(criarEmenda(db, coord, dados({ valorAprovado: "-5" })))).toBe("VALIDACAO");
    expect(await erroDe(criarEmenda(db, coord, dados({ cnpj: "11.222.333/0001-00" })))).toBe("VALIDACAO");
    await criarEmenda(db, coord, dados());
    expect(await erroDe(criarEmenda(db, coord, dados()))).toBe("CONFLITO");
    expect(await erroDe(criarEmenda(db, coord, dados({ esfera: "ESTADUAL" })))).toBe("SEM_ERRO");
    expect(await erroDe(criarEmenda(db, coord, dados({ ano: "2025" })))).toBe("SEM_ERRO");
    expect(await erroDe(criarEmenda(db, coord, dados({ numero: "" })))).toBe("SEM_ERRO");
    expect(await erroDe(criarEmenda(db, coord, dados({ numero: "" })))).toBe("SEM_ERRO");
    const consulta = await criarUsuarioTeste("CONSULTA");
    expect(await erroDe(criarEmenda(db, consulta, dados({ numero: "999" })))).toBe("PROIBIDO");
    expect(await erroDe(listarEmendas(db, consulta))).toBe("SEM_ERRO");
  });

  it("assessor edita só as próprias ou sob sua responsabilidade; edição gera histórico e auditoria", async () => {
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const a2 = await criarUsuarioTeste("ASSESSOR");
    const deCoord = await criarEmenda(db, coord, dados());
    expect(await erroDe(atualizarEmenda(db, a1, deCoord.id, dados({ objeto: "Objeto alterado pelo assessor" })))).toBe("PROIBIDO");
    expect(await erroDe(registrarLancamento(db, a1, deCoord.id, { tipo: "EMPENHO", valor: "10", data: "2026-01-10" }))).toBe("PROIBIDO");
    await atualizarEmenda(db, coord, deCoord.id, dados({ responsavelId: a1.id }));
    await atualizarEmenda(db, a1, deCoord.id, dados({ responsavelId: a1.id, objeto: "Objeto alterado pelo assessor", valorIndicado: "160000" }));
    expect(await erroDe(atualizarEmenda(db, a2, deCoord.id, dados()))).toBe("PROIBIDO");
    const o = await obterEmenda(db, a1, deCoord.id);
    expect(o.objeto).toBe("Objeto alterado pelo assessor");
    expect(o.valores.indicado).toBe(16_000_000);
    expect(o.historico.map((h) => h.tipo)).toEqual(expect.arrayContaining(["EDICAO", "RESPONSAVEL"]));
    const aud = await db.auditLog.findFirst({ where: { entidade: "emenda", registroId: deCoord.id, acao: "EDITAR", usuarioId: a1.id } });
    expect(aud?.valorNovo).toMatchObject({ valorIndicado: "160000.00" });
    expect((await obterEmenda(db, a2, deCoord.id)).podeEditar).toBe(false);
  });

  it("não deixa reduzir o aprovado abaixo do já empenhado", async () => {
    const e = await criarEmenda(db, coord, dados());
    await registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "90.000,00", data: "2026-02-01" });
    expect(await erroDe(atualizarEmenda(db, coord, e.id, dados({ valorAprovado: "80.000,00" })))).toBe("VALIDACAO");
    expect(await erroDe(atualizarEmenda(db, coord, e.id, dados({ valorAprovado: "90.000,00" })))).toBe("SEM_ERRO");
  });
});

describe("emendas — status", () => {
  it("cancelamento e impedimento técnico exigem motivo; histórico guarda de/para", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "CANCELADA" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "IMPEDIMENTO_TECNICO", comentario: "" }))).toBe("VALIDACAO");
    await alterarStatusEmenda(db, coord, e.id, { status: "IMPEDIMENTO_TECNICO", comentario: "Plano de trabalho fictício incompleto" });
    const h = await db.emendaHistorico.findFirst({ where: { emendaId: e.id, tipo: "STATUS" } });
    expect(h).toMatchObject({ statusAnterior: "EM_NEGOCIACAO", statusNovo: "IMPEDIMENTO_TECNICO" });
    expect(h?.descricao).toContain("Plano de trabalho");
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "IMPEDIMENTO_TECNICO", comentario: "x" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "XYZ" }))).toBe("VALIDACAO");
  });

  it("status de execução exigem os lançamentos correspondentes", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "EMPENHADA" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "PAGA" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatusEmenda(db, coord, e.id, { status: "APROVADA" }))).toBe("SEM_ERRO");
  });
});

describe("emendas — execução financeira", () => {
  it("lançamentos fecham os valores e calculam saldo; primeiro empenho muda o status", async () => {
    const e = await criarEmenda(db, coord, dados());
    const lanc = (tipo: string, valor: string) => registrarLancamento(db, coord, e.id, { tipo, valor, data: "2026-03-01" });
    expect(await erroDe(lanc("EMPENHO", "100.000,01"))).toBe("VALIDACAO");
    expect(await erroDe(lanc("LIQUIDACAO", "10"))).toBe("VALIDACAO");
    await lanc("EMPENHO", "60.000,00");
    expect((await obterEmenda(db, coord, e.id)).status).toBe("EMPENHADA");
    await lanc("EMPENHO", "40.000,00");
    expect(await erroDe(lanc("EMPENHO", "0,01"))).toBe("VALIDACAO");
    await lanc("LIQUIDACAO", "70.000,00");
    expect(await erroDe(lanc("PAGAMENTO", "70.000,01"))).toBe("VALIDACAO");
    await lanc("PAGAMENTO", "50.000,00");
    const o = await obterEmenda(db, coord, e.id);
    expect(o.valores).toMatchObject({ empenhado: 10_000_000, liquidado: 7_000_000, pago: 5_000_000 });
    expect(o.resumo).toMatchObject({ saldo: 5_000_000, aEmpenhar: 0, aLiquidar: 3_000_000, percentualPago: 50 });
    expect(o.lancamentos).toHaveLength(4);
    expect(o.historico.filter((h) => h.tipo === "EXECUCAO")).toHaveLength(4);
    expect(await db.auditLog.count({ where: { entidade: "emenda_lancamento", acao: "CRIAR" } })).toBe(4);
  });

  it("não exclui empenho que deixaria a liquidação sem cobertura; exclui pagamento e recalcula", async () => {
    const e = await criarEmenda(db, coord, dados());
    const emp = await registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "50000", data: "2026-03-01" });
    await registrarLancamento(db, coord, e.id, { tipo: "LIQUIDACAO", valor: "50000", data: "2026-03-02" });
    const pag = await registrarLancamento(db, coord, e.id, { tipo: "PAGAMENTO", valor: "20000", data: "2026-03-03" });
    expect(await erroDe(excluirLancamento(db, coord, emp.id))).toBe("VALIDACAO");
    expect(await db.emendaLancamento.count({ where: { emendaId: e.id } })).toBe(3);
    await excluirLancamento(db, coord, pag.id);
    const o = await obterEmenda(db, coord, e.id);
    expect(o.valores.pago).toBe(0);
    expect(o.resumo.saldo).toBe(5_000_000);
    expect(await db.auditLog.count({ where: { entidade: "emenda_lancamento", acao: "EXCLUIR" } })).toBe(1);
  });

  it("rejeita valor zero, data futura, e lançamento em emenda cancelada", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(await erroDe(registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "0", data: "2026-01-01" }))).toBe("VALIDACAO");
    expect(await erroDe(registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "10", data: "2999-01-01" }))).toBe("VALIDACAO");
    expect(await erroDe(registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "10", data: "" }))).toBe("VALIDACAO");
    await alterarStatusEmenda(db, coord, e.id, { status: "CANCELADA", comentario: "Remanejada (fictício)" });
    expect(await erroDe(registrarLancamento(db, coord, e.id, { tipo: "EMPENHO", valor: "10", data: "2026-01-01" }))).toBe("VALIDACAO");
  });

  it("o banco recusa valores que não fecham mesmo fora do service", async () => {
    const e = await criarEmenda(db, coord, dados());
    await expect(db.emenda.update({ where: { id: e.id }, data: { valorPago: "10" } })).rejects.toThrow();
  });
});

describe("emendas ↔ mandatos", () => {
  it("emenda com vários mandatos e mandato com várias emendas", async () => {
    const e1 = await criarEmenda(db, coord, dados({ esfera: "ESTADUAL", numero: "1" }));
    const e2 = await criarEmenda(db, coord, dados({ esfera: "ESTADUAL", numero: "2" }));
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: estadual.id, tipo: "AUTOR" });
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: proprio.id, tipo: "ACOMPANHAMENTO", responsabilidade: "Acompanhar plano", dataInicio: "2026-01-01", dataFim: "2026-12-31" });
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: federal.id, tipo: "INTERMEDIARIO" });
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: estadual.id, tipo: "AUTOR" });
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: proprio.id, tipo: "ARTICULADOR" });
    expect((await obterEmenda(db, coord, e1.id)).mandatos).toHaveLength(3);
    expect(await db.emendaMandato.count({ where: { mandatoId: proprio.id } })).toBe(2);
    const vinc = await db.emendaMandato.findFirst({ where: { emendaId: e1.id, mandatoId: proprio.id } });
    expect(vinc).toMatchObject({ responsabilidade: "Acompanhar plano" });
    const p = await obterParlamentar(db, coord, (await db.mandato.findUniqueOrThrow({ where: { id: estadual.id } })).parlamentarId);
    expect(p.emendas).toHaveLength(2);
  });

  it("acompanhamento do mandato próprio não vira autoria", async () => {
    const e = await criarEmenda(db, coord, dados({ esfera: "ESTADUAL" }));
    await vincularMandatoEmenda(db, coord, e.id, { mandatoId: proprio.id, tipo: "ACOMPANHAMENTO" });
    await vincularMandatoEmenda(db, coord, e.id, { mandatoId: proprio.id, tipo: "ARTICULADOR" });
    expect((await obterEmenda(db, coord, e.id)).autor).toBeNull();
    expect((await listarEmendas(db, coord)).itens[0].autor).toBeNull();
    expect(await db.emendaMandato.count({ where: { tipo: { in: ["AUTOR", "COAUTOR"] } } })).toBe(0);
  });

  it("autoria: mesma esfera, mandato em exercício no ano, um único autor e sem autor+coautor", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "AUTOR" }))).toBe("VALIDACAO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: antigo.id, tipo: "AUTOR" }))).toBe("VALIDACAO");
    await vincularMandatoEmenda(db, coord, e.id, { mandatoId: proprio.id, tipo: "AUTOR" });
    expect((await obterEmenda(db, coord, e.id)).autor?.mandatoId).toBe(proprio.id);
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: proprio.id, tipo: "COAUTOR" }))).toBe("VALIDACAO");
    const outra = await criarParlamentar(db, coord, { nome: "Vereadora Fictícia", cargo: "VEREADOR" });
    const mv = await criarMandato(db, coord, outra.id, { cargo: "VEREADOR", dataInicio: "2025-01-01", dataFim: "2028-12-31" });
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: mv.id, tipo: "AUTOR" }))).toBe("CONFLITO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: mv.id, tipo: "COAUTOR" }))).toBe("SEM_ERRO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "PARCEIRO" }))).toBe("SEM_ERRO");
    expect(await erroDe(atualizarEmenda(db, coord, e.id, dados({ esfera: "ESTADUAL" })))).toBe("VALIDACAO");
  });

  it("duplicidade, período inválido, permissão e histórico de remoção", async () => {
    const e = await criarEmenda(db, coord, dados());
    const v = await vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "PARCEIRO" });
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "PARCEIRO" }))).toBe("CONFLITO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "EXECUCAO" }))).toBe("SEM_ERRO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: federal.id, tipo: "PARCEIRO", dataInicio: "2026-05-01", dataFim: "2026-04-01" }))).toBe("VALIDACAO");
    expect(await erroDe(vincularMandatoEmenda(db, coord, e.id, { mandatoId: federal.id, tipo: "NADA" }))).toBe("VALIDACAO");
    const assessor = await criarUsuarioTeste("ASSESSOR");
    expect(await erroDe(vincularMandatoEmenda(db, assessor, e.id, { mandatoId: federal.id, tipo: "PARCEIRO" }))).toBe("PROIBIDO");
    expect(await erroDe(desvincularMandatoEmenda(db, assessor, v.id))).toBe("PROIBIDO");
    await desvincularMandatoEmenda(db, coord, v.id);
    const h = await db.emendaHistorico.findMany({ where: { emendaId: e.id, tipo: "MANDATO" }, orderBy: { data: "asc" } });
    expect(h.at(-1)?.descricao).toMatch(/^Removeu vínculo/);
    expect(await db.auditLog.count({ where: { entidade: "emenda_mandato", acao: "EXCLUIR" } })).toBe(1);
  });

  it("mandato com emenda vinculada não pode ser excluído", async () => {
    const e = await criarEmenda(db, coord, dados({ esfera: "ESTADUAL" }));
    await vincularMandatoEmenda(db, coord, e.id, { mandatoId: estadual.id, tipo: "AUTOR" });
    expect(await erroDe(excluirMandato(db, coord, estadual.id))).toBe("VALIDACAO");
  });
});

describe("emendas — filtros, documentos e rede", () => {
  it("filtra por esfera, status, ano, responsável, parlamentar e busca; soma totais", async () => {
    const assessor = await criarUsuarioTeste("ASSESSOR");
    const a = await criarEmenda(db, coord, dados({ numero: "1", objeto: "Pavimentação fictícia da rua", responsavelId: assessor.id }));
    const b = await criarEmenda(db, coord, dados({ esfera: "FEDERAL", numero: "2", ano: "2025", beneficiario: "Instituto Fictício Beta" }));
    await vincularMandatoEmenda(db, coord, b.id, { mandatoId: federal.id, tipo: "AUTOR" });
    await alterarStatusEmenda(db, coord, b.id, { status: "CANCELADA", comentario: "Fictício" });
    await registrarLancamento(db, coord, a.id, { tipo: "EMPENHO", valor: "10000", data: "2026-01-02" });
    const ids = async (f: Record<string, string>, ator: Ator = coord) => (await listarEmendas(db, ator, f)).itens.map((i) => i.id);
    expect(await ids({ esfera: "FEDERAL" })).toEqual([b.id]);
    expect(await ids({ status: "CANCELADA" })).toEqual([b.id]);
    expect(await ids({ status: "andamento" })).toEqual([a.id]);
    expect(await ids({ ano: "2025" })).toEqual([b.id]);
    expect(await ids({ responsavel: "eu" }, assessor)).toEqual([a.id]);
    expect(await ids({ responsavel: "sem" })).toEqual([b.id]);
    expect(await ids({ q: "pavimenta" })).toEqual([a.id]);
    expect(await ids({ q: "beta" })).toEqual([b.id]);
    const parl = (await db.mandato.findUniqueOrThrow({ where: { id: federal.id } })).parlamentarId;
    expect(await ids({ parlamentarId: parl })).toEqual([b.id]);
    const l = await listarEmendas(db, coord);
    expect(l.totais).toMatchObject({ indicado: 30_000_000, aprovado: 20_000_000, empenhado: 1_000_000, pago: 0, saldo: 1_000_000 });
    expect(l.itens.find((i) => i.id === b.id)?.autor?.id).toBe(parl);
  });

  it("documentos: valida link e registra histórico", async () => {
    const e = await criarEmenda(db, coord, dados());
    expect(await erroDe(adicionarDocumento(db, coord, e.id, { tipo: "OFICIO", descricao: "Ofício", url: "javascript:alert(1)" }))).toBe("VALIDACAO");
    await adicionarDocumento(db, coord, e.id, { tipo: "PROCESSO", descricao: "Processo SEI fictício", numero: "0000.01", url: "https://exemplo.local/sei" });
    const o = await obterEmenda(db, coord, e.id);
    expect(o.documentos).toHaveLength(1);
    expect(o.historico.some((h) => h.tipo === "DOCUMENTO")).toBe(true);
  });

  it("rede: agrupa por parceiro e só inclui emendas com vínculo explícito do mandato próprio", async () => {
    const e1 = await criarEmenda(db, coord, dados({ esfera: "ESTADUAL", numero: "1" }));
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: estadual.id, tipo: "AUTOR" });
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: proprio.id, tipo: "ACOMPANHAMENTO" });
    const e2 = await criarEmenda(db, coord, dados({ numero: "2" }));
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: proprio.id, tipo: "AUTOR" });
    const e3 = await criarEmenda(db, coord, dados({ esfera: "FEDERAL", numero: "3" }));
    await vincularMandatoEmenda(db, coord, e3.id, { mandatoId: federal.id, tipo: "AUTOR" });
    const r = await redeMandatos(db, coord);
    expect(r.totais.emendas).toBe(2);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].emendas[0]).toMatchObject({ id: e1.id, tiposProprio: ["ACOMPANHAMENTO"], tiposParceiro: ["AUTOR"] });
    expect(r.semParceiro.map((x) => x.id)).toEqual([e2.id]);
    expect((await redeMandatos(db, coord, { esfera: "MUNICIPAL" })).totais.emendas).toBe(1);
  });
});

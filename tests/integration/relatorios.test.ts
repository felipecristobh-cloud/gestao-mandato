import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { alterarStatus, criarDemanda } from "@/server/services/demandas";
import { alterarStatusEmenda, criarEmenda, registrarLancamento, vincularMandatoEmenda } from "@/server/services/emendas";
import { criarMandato, criarParlamentar } from "@/server/services/parlamentares";
import { gerarRelatorio, registrarExportacao } from "@/server/services/relatorios";
import { gerarExcel } from "@/server/relatorios/excel";
import { gerarPDF } from "@/server/relatorios/pdf";
import { paraCSV, totais } from "@/lib/relatorios";
import { hojeISO, somarDias } from "@/lib/demandas";

type Ator = { id: string; nome: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };

let base: Awaited<ReturnType<typeof criarBase>>;
let coord: Ator;
let assessor: Ator;
let consulta: Ator;
const hoje = hojeISO();

const comNome = async (perfil: Ator["perfil"]): Promise<Ator> => {
  const u = await criarUsuarioTeste(perfil);
  const r = await db.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { nome: true } });
  return { id: u.id, perfil, nome: r.nome };
};

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  coord = await comNome("COORDENACAO");
  assessor = await comNome("ASSESSOR");
  consulta = await comNome("CONSULTA");
});

const demanda = (extra: Record<string, unknown> = {}) => ({
  solicitanteNome: `Pessoa Fictícia ${Math.random().toString(36).slice(2, 8)}`,
  telefone: "(31) 98888-0000",
  bairroId: String(base.bairro.id),
  temaId: String(base.tema.id),
  tipo: "SOLICITACAO",
  prioridade: "MEDIA",
  descricao: "Descrição fictícia de demanda para relatório",
  ...extra,
});
const emenda = (extra: Record<string, unknown> = {}) => ({
  esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", objeto: "Objeto fictício de emenda", valorIndicado: "1.000,00", ...extra,
});

describe("relatórios — demandas", () => {
  it("agrupa por regional com totais e respeita filtros", async () => {
    const d1 = await criarDemanda(db, coord, demanda({ prazo: somarDias(hoje, -2), responsavelId: assessor.id }));
    await criarDemanda(db, coord, demanda({ bairroId: String(base.bairroOeste.id) }));
    await criarDemanda(db, coord, demanda({ bairroId: "" }));
    const d4 = await criarDemanda(db, coord, demanda());
    await alterarStatus(db, coord, d4.id, { status: "RESOLVIDA" });

    const r = await gerarRelatorio(db, consulta, "demandas-regional", {}, hoje);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]).toMatchObject({ grupo: base.regional.nome, total: 2, abertas: 1, atrasadas: 1, resolvidas: 1, tempo: 0 });
    expect(r.linhas.map((l) => l.grupo)).toContain("Sem bairro/regional");
    expect(totais(r)).toMatchObject({ total: 4, resolvidas: 1, taxa: 25 });
    expect(r.filtros).toEqual(["Sem filtros"]);

    const meu = await gerarRelatorio(db, assessor, "demandas-tema", { responsavel: "eu", regionalId: String(base.regional.id) }, hoje);
    expect(meu.linhas).toEqual([expect.objectContaining({ grupo: base.tema.nome, total: 1 })]);
    expect(meu.filtros).toEqual([`Regional: ${base.regional.nome}`, `Responsável: ${assessor.nome}`]);

    const atr = await gerarRelatorio(db, consulta, "demandas-atrasadas", { pessoais: "1" }, hoje);
    expect(atr.linhas).toEqual([expect.objectContaining({ protocolo: d1.protocolo, dias: 2, responsavel: assessor.nome })]);
    expect(atr.colunas.map((c) => c.chave)).not.toContain("solicitante");

    const res = await gerarRelatorio(db, coord, "demandas-resolvidas", { pessoais: "1", de: hoje, ate: hoje }, hoje);
    expect(res.linhas).toHaveLength(1);
    expect(res.linhas[0].solicitante).toMatch(/^Pessoa Fictícia/);
    expect(res.linhas[0].telefone).toBeTruthy();
    expect(res.filtros.at(-1)).toMatch(/dados pessoais/);
    expect((await gerarRelatorio(db, coord, "demandas-resolvidas", { de: somarDias(hoje, 1) }, hoje)).linhas).toHaveLength(0);
  });
});

describe("relatórios — emendas", () => {
  it("valores por esfera, parlamentar e listas; canceladas fora por padrão", async () => {
    const e1 = await criarEmenda(db, coord, emenda({ numero: "1", valorAprovado: "800,00" }));
    const e2 = await criarEmenda(db, coord, emenda({ numero: "2", esfera: "FEDERAL" }));
    const e3 = await criarEmenda(db, coord, emenda({ numero: "3" }));
    await registrarLancamento(db, coord, e1.id, { tipo: "EMPENHO", valor: "800,00", data: hoje });
    await registrarLancamento(db, coord, e1.id, { tipo: "LIQUIDACAO", valor: "400,00", data: hoje });
    await registrarLancamento(db, coord, e1.id, { tipo: "PAGAMENTO", valor: "200,00", data: hoje });
    await alterarStatusEmenda(db, coord, e3.id, { status: "CANCELADA", comentario: "Cancelada no teste" });
    const p = await criarParlamentar(db, coord, { nome: "Deputada Fictícia", cargo: "DEPUTADO_FEDERAL" });
    const m = await criarMandato(db, coord, p.id, { cargo: "DEPUTADO_FEDERAL", dataInicio: "2023-02-01", dataFim: "2027-01-31" });
    await vincularMandatoEmenda(db, coord, e2.id, { mandatoId: m.id, tipo: "AUTOR" });
    await vincularMandatoEmenda(db, coord, e1.id, { mandatoId: m.id, tipo: "ACOMPANHAMENTO" });

    const esf = await gerarRelatorio(db, consulta, "emendas-esfera", {}, hoje);
    expect(esf.linhas).toEqual([
      expect.objectContaining({ grupo: "Federal", qtd: 1, base: 100000, pago: 0 }),
      expect.objectContaining({ grupo: "Municipal", qtd: 1, base: 80000, empenhado: 80000, liquidado: 40000, pago: 20000, apagar: 60000 }),
    ]);
    expect(totais(esf)).toMatchObject({ qtd: 2, base: 180000, pago: 20000, execucao: 11.1 });
    expect((await gerarRelatorio(db, consulta, "emendas-esfera", { status: "todas" }, hoje)).linhas.find((l) => l.grupo === "Municipal")?.qtd).toBe(2);

    const parl = await gerarRelatorio(db, consulta, "emendas-parlamentar", {}, hoje);
    expect(parl.linhas.map((l) => [l.grupo, l.qtd])).toEqual(expect.arrayContaining([["Deputada Fictícia", 1], ["Autor não informado", 1]]));
    expect(totais(parl)).toBeNull();

    const mand = await gerarRelatorio(db, consulta, "emendas-mandato", {}, hoje);
    expect(mand.linhas.map((l) => l.participacao)).toEqual(expect.arrayContaining(["Autor", "Acompanhamento"]));

    const pagos = await gerarRelatorio(db, consulta, "emendas-pago", {}, hoje);
    expect(pagos.linhas).toEqual([expect.objectContaining({ codigo: e1.codigo, valor: 20000, autor: "Não informado" })]);
    const exec = await gerarRelatorio(db, consulta, "emendas-execucao", { esfera: "FEDERAL" }, hoje);
    expect(exec.linhas).toEqual([expect.objectContaining({ codigo: e2.codigo, autor: "Deputada Fictícia", esfera: "Federal" })]);
  });
});

describe("relatórios — arquivos e auditoria", () => {
  it("gera CSV, Excel com fórmulas e PDF; registra a exportação", async () => {
    await criarEmenda(db, coord, emenda({ numero: "1", valorAprovado: "800,00" }));
    await criarEmenda(db, coord, emenda({ numero: "2", esfera: "ESTADUAL" }));
    const r = await gerarRelatorio(db, coord, "emendas-esfera", {}, hoje);

    expect(paraCSV(r)).toContain("TOTAL;2;2000,00;1800,00");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarExcel(r)) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const valores = ws.getSheetValues().flat().filter(Boolean) as unknown[];
    expect(valores).toContain("EMENDAS POR ESFERA");
    expect(valores).toContain(800);
    const formulas = valores.filter((v): v is { formula: string } => typeof v === "object" && v !== null && "formula" in v).map((v) => v.formula);
    expect(formulas.some((f) => /^SUM\(B\d+:B\d+\)$/.test(f))).toBe(true);
    expect(formulas.some((f) => /^IF\(D\d+=0,"",G\d+\/D\d+\)$/.test(f))).toBe(true);

    const pdf = await gerarPDF(r);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const vazio = await gerarPDF(await gerarRelatorio(db, coord, "demandas-atrasadas", {}, hoje));
    expect(vazio.length).toBeGreaterThan(500);

    await registrarExportacao(db, assessor, "emendas-esfera", "xlsx", {}, r);
    const log = await db.auditLog.findFirstOrThrow({ where: { usuarioId: assessor.id, acao: "EXPORTAR" } });
    expect(log.descricao).toBe("Emendas por esfera (XLSX)");
    expect(log.valorNovo).toMatchObject({ tipo: "emendas-esfera", linhas: 2, dadosPessoais: false });
  });
});

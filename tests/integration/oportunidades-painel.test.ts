import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { alterarEtapa, avaliarOportunidade, criarOportunidade } from "@/server/services/oportunidades";
import { painelOportunidades } from "@/server/services/oportunidades-painel";
import { criarProposicao } from "@/server/services/proposicoes";
import { gerarRelatorio } from "@/server/services/relatorios";
import { gerarExcel } from "@/server/relatorios/excel";
import { gerarPDF } from "@/server/relatorios/pdf";
import { paraCSV } from "@/lib/relatorios";

type Ator = { id: string; nome: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };
let base: Awaited<ReturnType<typeof criarBase>>;
let coord: Ator;
let assessor: Ator;
let consulta: Ator;
let educacao: { id: number };
let saude: { id: number };

const comNome = async (perfil: Ator["perfil"]): Promise<Ator> => {
  const u = await criarUsuarioTeste(perfil);
  return { id: u.id, perfil, nome: (await db.usuario.findUniqueOrThrow({ where: { id: u.id } })).nome };
};

const op = (extra: Record<string, unknown> = {}) => ({
  nome: "Proposta fictícia", problema: "Problema fictício.", descricaoProblema: "Descrição fictícia.", publico: "Moradores",
  objetivo: "Objetivo fictício.", solucao: "Solução fictícia.", eixoId: educacao.id, ...extra,
});
const notas = (n: number) => ({ notaImpacto: n, notaAlcance: n, notaViabilidade: n, notaExecucao: n, notaInovacao: n });

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  coord = await comNome("COORDENACAO");
  assessor = await comNome("ASSESSOR");
  consulta = await comNome("CONSULTA");
  educacao = await db.eixoLegislativo.create({ data: { nome: "Educação" } });
  saude = await db.eixoLegislativo.create({ data: { nome: "Saúde pública" } });
});

async function cenario() {
  const a = await criarOportunidade(db, assessor, op({ nome: "Proposta A", regionalIds: [base.regional.id], responsavelId: assessor.id }));
  const b = await criarOportunidade(db, coord, op({ nome: "Proposta B", eixoId: saude.id, bairroIds: [base.bairroOeste.id], regionalIds: [base.regional.id] }));
  const c = await criarOportunidade(db, coord, op({ nome: "Proposta C" }));
  await avaliarOportunidade(db, coord, a.id, notas(5));
  await avaliarOportunidade(db, coord, b.id, notas(2));
  await alterarEtapa(db, coord, b.id, { etapa: "ELABORACAO" });
  await alterarEtapa(db, coord, c.id, { etapa: "LEI" });
  return { a, b, c };
}

describe("painel legislativo", () => {
  it("indicadores, média, eixo, regional (explícita ou pelo bairro) e prioridade", async () => {
    await cenario();
    await criarProposicao(db, coord, { tipo: "PL", numero: "1", ano: "2014", ementa: "Ementa fictícia", participacao: "AUTORIA", fonte: "Teste" });
    await criarProposicao(db, coord, { tipo: "PL", numero: "2", ano: "2025", ementa: "Ementa fictícia", participacao: "AUTORIA", fonte: "Teste" });
    const p = await painelOportunidades(db, consulta);
    expect(p.total).toBe(3);
    expect(Object.fromEntries(p.indicadores.map((i) => [i.chave, i.valor]))).toEqual({
      analise: 1, elaboracao: 1, vereador: 0, protocolo: 0, protocolados: 0, aprovados: 0, lei: 1,
    });
    expect(p.mediaNota).toBe(70);
    expect(p.avaliadas).toBe(2);
    expect(p.porEixo).toEqual([{ rotulo: "Educação", valor: 2 }, { rotulo: "Saúde pública", valor: 1 }]);
    expect(p.porRegional).toEqual([{ rotulo: "Leste", valor: 2 }, { rotulo: "Oeste", valor: 1 }]);
    expect(p.porPrioridade.find((x) => x.prioridade === "MAXIMA")?.valor).toBe(1);
    expect(p.semAvaliacao).toBe(1);
    expect(p.historico.porMandato.map((m) => m.valor)).toEqual([1, 0, 0, 1]);
  });

  it("filtros por tema, responsável, etapa e período", async () => {
    await cenario();
    expect((await painelOportunidades(db, consulta, { eixo: String(saude.id) })).total).toBe(1);
    expect((await painelOportunidades(db, assessor, { responsavel: "eu" })).total).toBe(1);
    expect((await painelOportunidades(db, consulta, { responsavel: "nenhum" })).total).toBe(2);
    expect((await painelOportunidades(db, consulta, { etapa: "LEI" })).total).toBe(1);
    expect((await painelOportunidades(db, consulta, { ate: "2020-01-01" })).total).toBe(0);
    expect((await painelOportunidades(db, consulta, { de: "2020-01-01" })).total).toBe(3);
  });
});

describe("relatórios de oportunidades", () => {
  it("lista e agrupamentos em CSV, Excel e PDF", async () => {
    await cenario();
    const lista = await gerarRelatorio(db, consulta, "oportunidades-lista", {});
    expect(lista.linhas.map((l) => l.nome)).toEqual(["Proposta A", "Proposta B", "Proposta C"]);
    expect(lista.linhas[0]).toMatchObject({ nota: 100, regionais: "Leste", etapa: "Ideia cadastrada" });
    expect(lista.observacao).toMatch(/não significa constitucionalidade/);
    const porEixo = await gerarRelatorio(db, consulta, "oportunidades-eixo", {});
    expect(porEixo.linhas.map((l) => [l.grupo, l.total, l.lei])).toEqual([["Educação", 2, 1], ["Saúde pública", 1, 0]]);
    const porEtapa = await gerarRelatorio(db, consulta, "oportunidades-etapa", { eixoId: String(educacao.id) });
    expect(porEtapa.linhas.map((l) => l.grupo)).toEqual(["Ideia cadastrada", "Transformada em lei"]);
    expect(porEtapa.filtros).toContain("Eixo: Educação");
    const porRegional = await gerarRelatorio(db, consulta, "oportunidades-regional", {});
    expect(porRegional.linhas.map((l) => l.grupo)).toEqual(["Leste", "Oeste", "Sem regional"]);
    expect(paraCSV(porEixo)).toContain("Educação;2");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarExcel(porEixo)) as unknown as ArrayBuffer);
    expect(wb.worksheets[0].rowCount).toBeGreaterThan(3);
    expect((await gerarPDF(lista)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("histórico legislativo com filtros de ano e verificação", async () => {
    await criarProposicao(db, coord, { tipo: "PL", numero: "1", ano: "2014", ementa: "Ementa um", participacao: "AUTORIA", fonte: "Teste" });
    await criarProposicao(db, coord, {
      tipo: "REQ", numero: "2", ano: "2022", ementa: "Ementa dois", participacao: "COAUTORIA", fonte: "Teste", verificacao: "CONFIRMADO", linkOficial: "https://www.cmbh.mg.gov.br/2",
    });
    const r = await gerarRelatorio(db, consulta, "proposicoes-lista", { verificacao: "CONFIRMADO" });
    expect(r.linhas).toEqual([expect.objectContaining({ proposicao: "REQ 2/2022", participacao: "Coautoria", verificacao: "Confirmado em fonte oficial" })]);
    expect(r.filtros).toContain("Verificação: Confirmado em fonte oficial");
    expect((await gerarRelatorio(db, consulta, "proposicoes-lista", { ano: "2014" })).linhas).toHaveLength(1);
  });
});

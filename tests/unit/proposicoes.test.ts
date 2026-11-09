import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { lerCsv, lerPlanilha } from "@/server/proposicoes/planilha";
import { lerData, proposicaoSchema } from "@/lib/validacao/proposicao";
import { mandatoDoAno, participacaoDe, tipoProposicaoDe, verificacaoDe } from "@/lib/proposicoes";

describe("histórico legislativo — utilitários", () => {
  it("mandatos confirmados cobrem 2013–2028 sem buracos", () => {
    expect(mandatoDoAno(2012)).toBeNull();
    expect(mandatoDoAno(2013)?.numero).toBe(1);
    expect(mandatoDoAno(2020)?.numero).toBe(2);
    expect(mandatoDoAno(2021)?.numero).toBe(3);
    expect(mandatoDoAno(2028)?.numero).toBe(4);
    expect(mandatoDoAno(2029)).toBeNull();
  });

  it("reconhece tipo, autoria e verificação por sigla ou extenso", () => {
    expect(tipoProposicaoDe("PL")).toBe("PROJETO_LEI");
    expect(tipoProposicaoDe("Projeto de Resolução")).toBe("PROJETO_RESOLUCAO");
    expect(tipoProposicaoDe("pedido de informações")).toBe("PEDIDO_INFORMACAO");
    expect(tipoProposicaoDe("xyz")).toBeNull();
    expect(participacaoDe("Coautoria")).toBe("COAUTORIA");
    expect(participacaoDe("participação em discussão")).toBe("DISCUSSAO");
    expect(verificacaoDe("Confirmado em fonte oficial")).toBe("CONFIRMADO");
  });

  it("datas: DD/MM/AAAA ou ISO, só dentro dos mandatos", () => {
    expect((lerData("15/03/2021") as Date).toISOString()).toBe("2021-03-15T00:00:00.000Z");
    expect((lerData("2014-02-01") as Date).toISOString().slice(0, 10)).toBe("2014-02-01");
    expect(lerData("31/02/2021")).toBe("invalida");
    expect(lerData("01/01/2010")).toBe("invalida");
    expect(lerData("")).toBeNull();
  });

  it("valida número, ano, tipo e exige link para confirmado", () => {
    const base = { tipo: "PL", numero: "12", ano: "2015", ementa: "Ementa fictícia", participacao: "Autoria", fonte: "Portal CMBH" };
    expect(proposicaoSchema.safeParse(base).success).toBe(true);
    const msg = (v: object) => { const r = proposicaoSchema.safeParse({ ...base, ...v }); return r.success ? null : r.error.issues[0].message; };
    expect(msg({ numero: "12a" })).toMatch(/Número inválido/);
    expect(msg({ ano: "2011" })).toMatch(/fora dos mandatos/);
    expect(msg({ tipo: "Moção" })).toMatch(/desconhecido/);
    expect(msg({ verificacao: "Confirmado" })).toMatch(/link oficial/);
    expect(msg({ verificacao: "Confirmado", linkOficial: "https://www.cmbh.mg.gov.br/x" })).toBeNull();
    expect(msg({ fonte: "" })).toMatch(/fonte/);
  });

  it("CSV com ; e aspas, e cabeçalhos com acento", async () => {
    expect(lerCsv('a;b\n"x;1";"di""z"\r\n')).toEqual([["a", "b"], ["x;1", 'di"z']]);
    const csv = "\uFEFFTipo;Número;Ano;Ementa;Autoria;Coluna Extra\nPL;10;2014;Ementa;Autoria;zzz\n;;;;;\n";
    const r = await lerPlanilha("h.csv", Buffer.from(csv));
    expect(r.linhas).toEqual([{ tipo: "PL", numero: "10", ano: "2014", ementa: "Ementa", participacao: "Autoria" }]);
    expect(r.ignoradas).toEqual(["Coluna Extra"]);
  });

  it("XLSX com data e hyperlink", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("p");
    ws.addRow(["Tipo", "Numero", "Ano", "Data de apresentação", "Link"]);
    ws.addRow(["REQ", 5, 2019, new Date(Date.UTC(2019, 4, 2)), { text: "ver", hyperlink: "https://www.cmbh.mg.gov.br/p/5" }]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await lerPlanilha("h.xlsx", buf);
    expect(r.linhas[0]).toEqual({ tipo: "REQ", numero: "5", ano: "2019", dataApresentacao: "2019-05-02", linkOficial: "https://www.cmbh.mg.gov.br/p/5" });
  });

  it("recusa formato, cabeçalho e arquivo falso", async () => {
    await expect(lerPlanilha("a.pdf", Buffer.from("x"))).rejects.toThrow(/xlsx ou \.csv/);
    await expect(lerPlanilha("a.csv", Buffer.from("foo;bar\n1;2"))).rejects.toThrow(/Tipo, Número e Ano/);
    await expect(lerPlanilha("a.xlsx", Buffer.from("não é zip"))).rejects.toThrow(/não é um .xlsx/);
  });
});

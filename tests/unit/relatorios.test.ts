import { describe, expect, it } from "vitest";
import { ehFormato, ehTipoRelatorio, formatarCelula, nomeArquivo, paraCSV, totais, valorCalculado, type Relatorio } from "@/lib/relatorios";

const base = (): Relatorio => ({
  titulo: "Teste",
  filtros: [],
  geradoEm: new Date("2026-10-13T12:00:00Z"),
  geradoPor: "Fulano",
  colunas: [
    { chave: "grupo", titulo: "Grupo", tipo: "texto" },
    { chave: "qtd", titulo: "Qtd", tipo: "inteiro", somar: true },
    { chave: "base", titulo: "Valor", tipo: "moeda", somar: true },
    { chave: "pago", titulo: "Pago", tipo: "moeda", somar: true },
    { chave: "pct", titulo: "% pago", tipo: "percentual", razao: { num: "pago", den: "base" } },
    { chave: "data", titulo: "Data", tipo: "data" },
  ],
  linhas: [
    { grupo: "Leste; Centro", qtd: 2, base: 123456, pago: 61728, data: "2026-03-05" },
    { grupo: "=HYPERLINK(\"x\")", qtd: 1, base: 0, pago: 0, data: null },
  ],
});

describe("relatórios — cálculo", () => {
  it("razão vira percentual com 1 casa e sem divisão por zero", () => {
    const r = base();
    expect(valorCalculado(r.linhas[0], r.colunas[4])).toBe(50);
    expect(valorCalculado(r.linhas[1], r.colunas[4])).toBeNull();
  });
  it("totais somam só as colunas somáveis e recalculam a razão", () => {
    const t = totais(base())!;
    expect(t).toMatchObject({ grupo: "TOTAL", qtd: 3, base: 123456, pago: 61728, pct: 50 });
    expect(t.data).toBeUndefined();
  });
  it("formata para tela/PDF", () => {
    expect(formatarCelula(123456, "moeda").replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatarCelula(12.5, "percentual")).toBe("12,5%");
    expect(formatarCelula("2026-03-05", "data")).toBe("05/03/2026");
    expect(formatarCelula(null, "texto")).toBe("—");
  });
});

describe("relatórios — CSV", () => {
  it("usa ; e vírgula decimal, BOM, aspas e neutraliza fórmulas", () => {
    const csv = paraCSV(base());
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const l = csv.slice(1).trim().split("\r\n");
    expect(l[0]).toBe("Grupo;Qtd;Valor;Pago;% pago;Data");
    expect(l[1]).toBe('"Leste; Centro";2;1234,56;617,28;50;05/03/2026');
    expect(l[2]).toBe(`"'=HYPERLINK(""x"")";1;0,00;0,00;;`);
    expect(l[3]).toBe("TOTAL;3;1234,56;617,28;50;");
  });
  it("valida tipo e formato e monta o nome do arquivo", () => {
    expect(ehTipoRelatorio("demandas-regional")).toBe(true);
    expect(ehTipoRelatorio("__proto__")).toBe(false);
    expect(ehFormato("xlsx")).toBe(true);
    expect(ehFormato("exe")).toBe(false);
    expect(nomeArquivo("emendas-pago", "pdf", "2026-10-13")).toBe("relatorio-emendas-pago-2026-10-13.pdf");
  });
});

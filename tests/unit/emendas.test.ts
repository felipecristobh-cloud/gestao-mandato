import { describe, expect, it } from "vitest";
import { centavos, cnpjValido, completarCnpj, erroValores, formatarCnpj, lerValor, resumoFinanceiro, totaisLancamentos } from "@/lib/emendas";

describe("lerValor", () => {
  it("aceita formatos brasileiros e com ponto decimal", () => {
    expect(lerValor("1.234,56")).toBe(123456);
    expect(lerValor("R$ 150.000,00")).toBe(15000000);
    expect(lerValor("1234.5")).toBe(123450);
    expect(lerValor("10")).toBe(1000);
    expect(lerValor("0,1")).toBe(10);
  });
  it("vazio vira null e lixo vira NaN", () => {
    expect(lerValor("")).toBeNull();
    expect(lerValor(undefined)).toBeNull();
    expect(lerValor("abc")).toBeNaN();
    expect(lerValor("-10")).toBeNaN();
    expect(lerValor("1,234")).toBeNaN();
  });
});

describe("centavos", () => {
  it("converte Decimal/strings sem erro de ponto flutuante", () => {
    expect(centavos("0.1")).toBe(10);
    expect(centavos("1234567890.99")).toBe(123456789099);
    expect(centavos(null)).toBe(0);
    expect(centavos({ toString: () => "150000" })).toBe(15000000);
  });
});

describe("valores da emenda", () => {
  const base = { indicado: 100_00, aprovado: 80_00, empenhado: 80_00, liquidado: 50_00, pago: 30_00 };
  it("calcula saldo (empenhado − pago), falta empenhar e percentual pago", () => {
    const r = resumoFinanceiro(base);
    expect(r.saldo).toBe(50_00);
    expect(r.aEmpenhar).toBe(0);
    expect(r.aLiquidar).toBe(30_00);
    expect(r.aPagarLiquidado).toBe(20_00);
    expect(r.percentualPago).toBe(37.5);
  });
  it("sem aprovado, a base é o indicado", () => {
    expect(resumoFinanceiro({ ...base, aprovado: null, empenhado: 0, liquidado: 0, pago: 0 }).aEmpenhar).toBe(100_00);
  });
  it("exige pago ≤ liquidado ≤ empenhado ≤ aprovado", () => {
    expect(erroValores(base)).toBeNull();
    expect(erroValores({ ...base, pago: 60_00 })).toMatch(/pago/);
    expect(erroValores({ ...base, liquidado: 90_00 })).toMatch(/liquidado/);
    expect(erroValores({ ...base, aprovado: 70_00 })).toMatch(/empenhado/);
    expect(erroValores({ ...base, indicado: -1 })).toMatch(/negativos/);
  });
  it("soma lançamentos por tipo", () => {
    expect(totaisLancamentos([
      { tipo: "EMPENHO", valor: "100.10" }, { tipo: "EMPENHO", valor: "0.20" }, { tipo: "LIQUIDACAO", valor: "50" }, { tipo: "PAGAMENTO", valor: 10 },
    ])).toEqual({ empenhado: 10030, liquidado: 5000, pago: 1000 });
  });
});

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    const c = completarCnpj("112223330001");
    expect(c).toHaveLength(14);
    expect(cnpjValido(c)).toBe(true);
    expect(cnpjValido(formatarCnpj(c))).toBe(true);
    expect(cnpjValido(`${c.slice(0, 13)}${(Number(c[13]) + 1) % 10}`)).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });
});

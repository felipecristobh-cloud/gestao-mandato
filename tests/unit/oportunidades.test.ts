import { describe, expect, it } from "vitest";
import { CRITERIOS, calcularNotaFinal, classificarNota, prioridadeEfetiva } from "@/lib/oportunidades";

const todas = (v: number) => Object.fromEntries(CRITERIOS.map((c) => [c.campo, v]));

describe("pontuação das oportunidades", () => {
  it("pesos somam 100", () => {
    expect(CRITERIOS.reduce((s, c) => s + c.peso, 0)).toBe(100);
  });

  it("calcula de 0 a 100 com os pesos", () => {
    expect(calcularNotaFinal(todas(5))).toBe(100);
    expect(calcularNotaFinal(todas(0))).toBe(0);
    expect(calcularNotaFinal({ notaImpacto: 5, notaAlcance: 0, notaViabilidade: 0, notaExecucao: 0, notaInovacao: 0 })).toBe(30);
    expect(calcularNotaFinal({ notaImpacto: 4, notaAlcance: 3, notaViabilidade: 5, notaExecucao: 2, notaInovacao: 1 })).toBe(65);
  });

  it("fica nula se faltar critério", () => {
    expect(calcularNotaFinal({ notaImpacto: 5 })).toBeNull();
  });

  it("classifica nas faixas", () => {
    expect([100, 80, 79, 60, 59, 40, 39, 0].map(classificarNota)).toEqual(["MAXIMA", "MAXIMA", "ALTA", "ALTA", "INTERMEDIARIA", "INTERMEDIARIA", "BAIXA", "BAIXA"]);
  });

  it("prioridade manual prevalece", () => {
    expect(prioridadeEfetiva({ notaFinal: 90, prioridadeManual: "BAIXA" })).toBe("BAIXA");
    expect(prioridadeEfetiva({ notaFinal: 90, prioridadeManual: null })).toBe("MAXIMA");
    expect(prioridadeEfetiva({ notaFinal: null, prioridadeManual: null })).toBeNull();
  });
});

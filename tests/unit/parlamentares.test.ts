import { describe, expect, it } from "vitest";
import { TIPOS_PARTICIPACAO, TIPOS_PARTICIPACAO_DEMANDA, esferaDoCargo, periodosSobrepostos, situacaoMandato } from "@/lib/parlamentares";
import { deISO } from "@/lib/demandas";

const p = (inicio: string, fim: string | null) => ({ inicio: deISO(inicio), fim: fim ? deISO(fim) : null });

describe("parlamentares — regras puras", () => {
  it("esfera vem do cargo; só Outro respeita a escolha", () => {
    expect(esferaDoCargo("VEREADOR", "FEDERAL")).toBe("MUNICIPAL");
    expect(esferaDoCargo("DEPUTADO_ESTADUAL")).toBe("ESTADUAL");
    expect(esferaDoCargo("DEPUTADO_FEDERAL")).toBe("FEDERAL");
    expect(esferaDoCargo("SENADOR")).toBe("FEDERAL");
    expect(esferaDoCargo("OUTRO", "ESTADUAL")).toBe("ESTADUAL");
    expect(esferaDoCargo("OUTRO", null)).toBe("MUNICIPAL");
  });

  it("detecta sobreposição de períodos, inclusive em aberto", () => {
    expect(periodosSobrepostos(p("2021-01-01", "2024-12-31"), p("2025-01-01", "2028-12-31"))).toBe(false);
    expect(periodosSobrepostos(p("2021-01-01", "2024-12-31"), p("2024-12-31", "2028-12-31"))).toBe(true);
    expect(periodosSobrepostos(p("2021-01-01", null), p("2030-01-01", "2030-12-31"))).toBe(true);
    expect(periodosSobrepostos(p("2021-01-01", "2022-01-01"), p("2019-01-01", null))).toBe(true);
    expect(periodosSobrepostos(p("2025-01-01", "2028-12-31"), p("2019-01-01", "2020-12-31"))).toBe(false);
  });

  it("situação do mandato pela data de hoje", () => {
    expect(situacaoMandato(deISO("2025-01-01"), deISO("2028-12-31"), "2026-10-06")).toBe("VIGENTE");
    expect(situacaoMandato(deISO("2025-01-01"), deISO("2028-12-31"), "2028-12-31")).toBe("VIGENTE");
    expect(situacaoMandato(deISO("2017-01-01"), deISO("2020-12-31"), "2026-10-06")).toBe("ENCERRADO");
    expect(situacaoMandato(deISO("2027-02-01"), null, "2026-10-06")).toBe("FUTURO");
    expect(situacaoMandato(deISO("2020-01-01"), null, "2026-10-06")).toBe("VIGENTE");
  });

  it("autoria e coautoria não existem em demandas", () => {
    expect(TIPOS_PARTICIPACAO).toHaveLength(7);
    expect(TIPOS_PARTICIPACAO_DEMANDA).not.toContain("AUTOR");
    expect(TIPOS_PARTICIPACAO_DEMANDA).not.toContain("COAUTOR");
  });
});

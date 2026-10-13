import { describe, expect, it } from "vitest";
import { formatarPercentual, inicioPeriodo, lerPeriodo, mesesEntre, percentual, rotuloMes } from "@/lib/dashboard";

describe("dashboard — período", () => {
  it("12 meses começa no 1º dia do mês, 11 meses antes", () => {
    expect(inicioPeriodo("12m", "2026-10-13")).toBe("2025-11-01");
    expect(inicioPeriodo("12m", "2026-01-31")).toBe("2025-02-01");
  });
  it("ano atual e todo o período", () => {
    expect(inicioPeriodo("ano", "2026-10-13")).toBe("2026-01-01");
    expect(inicioPeriodo("tudo", "2026-10-13")).toBeNull();
  });
  it("valor inválido cai em 12 meses", () => {
    expect(lerPeriodo("xyz")).toBe("12m");
    expect(lerPeriodo(undefined)).toBe("12m");
    expect(lerPeriodo("ano")).toBe("ano");
  });
});

describe("dashboard — meses e percentuais", () => {
  it("lista meses atravessando o ano", () => {
    expect(mesesEntre("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(mesesEntre("2026-03", "2026-03")).toEqual(["2026-03"]);
    expect(mesesEntre("2026-04", "2026-03")).toEqual([]);
  });
  it("rótulo curto do mês", () => {
    expect(rotuloMes("2026-09")).toBe("set/26");
    expect(rotuloMes("2027-01")).toBe("jan/27");
  });
  it("percentual com uma casa e sem divisão por zero", () => {
    expect(percentual(1, 3)).toBe(33.3);
    expect(percentual(0, 0)).toBeNull();
    expect(formatarPercentual(null)).toBe("—");
    expect(formatarPercentual(12.5)).toBe("12,5%");
  });
});

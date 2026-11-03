import { describe, expect, it } from "vitest";
import { deISO, hojeISO, situacaoPrazo, somarDias } from "@/lib/demandas";

describe("prazos de demandas", () => {
  const hoje = "2026-10-06";
  const em = (n: number) => deISO(somarDias(hoje, n));

  it("classifica atrasada, hoje, 7/15/30 dias e no prazo", () => {
    expect(situacaoPrazo(em(-3), "EM_ANALISE", hoje)).toEqual({ situacao: "ATRASADA", dias: -3 });
    expect(situacaoPrazo(em(0), "NOVA", hoje).situacao).toBe("HOJE");
    expect(situacaoPrazo(em(7), "NOVA", hoje).situacao).toBe("ATE_7");
    expect(situacaoPrazo(em(8), "NOVA", hoje).situacao).toBe("ATE_15");
    expect(situacaoPrazo(em(30), "NOVA", hoje).situacao).toBe("ATE_30");
    expect(situacaoPrazo(em(31), "NOVA", hoje).situacao).toBe("NO_PRAZO");
    expect(situacaoPrazo(null, "NOVA", hoje).situacao).toBe("SEM_PRAZO");
  });

  it("demanda concluída nunca fica atrasada", () => {
    for (const s of ["RESOLVIDA", "NAO_RESOLVIDA", "CANCELADA"] as const) {
      expect(situacaoPrazo(em(-10), s, hoje).situacao).toBe("CONCLUIDA");
    }
  });

  it("'hoje' usa o fuso de Belo Horizonte, não UTC", () => {
    expect(hojeISO(new Date("2026-10-07T01:30:00Z"))).toBe("2026-10-06");
    expect(hojeISO(new Date("2026-10-07T03:30:00Z"))).toBe("2026-10-07");
  });
});

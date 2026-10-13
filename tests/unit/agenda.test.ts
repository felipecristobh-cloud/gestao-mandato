import { describe, expect, it } from "vitest";
import { deDataHoraLocal, diaLocal, diasDoCalendario, inicioSemana, intervalosCruzam, paraDataHoraLocal, somarMeses } from "@/lib/agenda";
import { compromissoSchema, statusCompromissoSchema, alvoSchema } from "@/lib/validacao/agenda";
import { cnpjOpcional, vinculoEntidadeSchema } from "@/lib/validacao/entidade";
import { completarCnpj } from "@/lib/emendas";

const h = (v: string) => deDataHoraLocal(v)!;

describe("agenda — datas no fuso de BH", () => {
  it("converte datetime-local de/para BH (-03:00)", () => {
    expect(h("2026-10-05T14:30").toISOString()).toBe("2026-10-05T17:30:00.000Z");
    expect(paraDataHoraLocal(new Date("2026-10-06T01:15:00Z"))).toBe("2026-10-05T22:15");
    expect(diaLocal(new Date("2026-10-06T02:00:00Z"))).toBe("2026-10-05");
    expect(deDataHoraLocal("05/10/2026 14:30")).toBeNull();
  });

  it("semana começa na segunda e o mês cobre semanas completas", () => {
    expect(inicioSemana("2026-10-05")).toBe("2026-10-05");
    expect(inicioSemana("2026-10-11")).toBe("2026-10-05");
    const dias = diasDoCalendario("2026-10-15");
    expect(dias[0]).toBe("2026-09-28");
    expect(dias.length % 7).toBe(0);
    expect(dias.at(-1)).toBe("2026-11-01");
    expect(somarMeses("2026-12-20", 1)).toBe("2027-01-01");
  });

  it("intervalos que só encostam não são choque", () => {
    const a = { inicio: h("2026-10-05T09:00"), fim: h("2026-10-05T10:00") };
    expect(intervalosCruzam(a, { inicio: h("2026-10-05T10:00"), fim: h("2026-10-05T11:00") })).toBe(false);
    expect(intervalosCruzam(a, { inicio: h("2026-10-05T09:59"), fim: h("2026-10-05T11:00") })).toBe(true);
    expect(intervalosCruzam(a, { inicio: h("2026-10-05T08:00"), fim: h("2026-10-05T12:00") })).toBe(true);
  });
});

describe("agenda — validação", () => {
  const base = { titulo: "Reunião fictícia", tipo: "REUNIAO", inicio: "2026-10-05T09:00", fim: "2026-10-05T10:00" };
  it("exige término depois do início e no máximo 7 dias", () => {
    expect(compromissoSchema.safeParse(base).success).toBe(true);
    expect(compromissoSchema.safeParse({ ...base, fim: "2026-10-05T09:00" }).success).toBe(false);
    expect(compromissoSchema.safeParse({ ...base, fim: "2026-10-13T09:00" }).success).toBe(false);
    expect(compromissoSchema.safeParse({ ...base, tipo: "FESTA" }).success).toBe(false);
  });
  it("remove participantes repetidos e normaliza a agenda do vereador", () => {
    const id = "6f1c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    const r = compromissoSchema.parse({ ...base, participantes: [id, id, ""], agendaVereador: "on" });
    expect(r.participantes).toEqual([id]);
    expect(r.agendaVereador).toBe(true);
    expect(compromissoSchema.safeParse({ ...base, participantes: ["x"] }).success).toBe(false);
  });
  it("status e alvo de vínculo", () => {
    expect(statusCompromissoSchema.safeParse({ status: "ADIADO" }).success).toBe(true);
    expect(statusCompromissoSchema.safeParse({ status: "FEITO" }).success).toBe(false);
    expect(alvoSchema.parse("entidade:6f1c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f").tipo).toBe("entidade");
    expect(alvoSchema.safeParse("pessoa:6f1c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f").success).toBe(false);
  });
});

describe("entidades — validação", () => {
  it("CNPJ opcional com dígito verificador", () => {
    const ok = completarCnpj("112223330001");
    expect(cnpjOpcional.parse("")).toBeNull();
    expect(cnpjOpcional.parse(ok.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"))).toBe(ok);
    expect(cnpjOpcional.safeParse("11.222.333/0001-00").success).toBe(false);
  });
  it("entidade nunca recebe autoria", () => {
    const m = "6f1c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    expect(vinculoEntidadeSchema.safeParse({ mandatoId: m, tipo: "PARCEIRO" }).success).toBe(true);
    expect(vinculoEntidadeSchema.safeParse({ mandatoId: m, tipo: "AUTOR" }).success).toBe(false);
    expect(vinculoEntidadeSchema.safeParse({ mandatoId: m, tipo: "COAUTOR" }).success).toBe(false);
  });
});

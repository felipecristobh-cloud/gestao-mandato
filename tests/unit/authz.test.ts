import { describe, expect, it } from "vitest";
import { MATRIZ, pode, exigir, podeEditarRegistro, podeVerContato } from "@/server/authz";
import { AppError } from "@/server/errors";

const admin = { id: "a", perfil: "ADMIN" as const };
const coord = { id: "c", perfil: "COORDENACAO" as const };
const assessor = { id: "s", perfil: "ASSESSOR" as const };
const consulta = { id: "q", perfil: "CONSULTA" as const };

describe("matriz de permissões", () => {
  it("só o admin gerencia usuários e anonimiza dados", () => {
    expect(pode(admin, "usuarios:gerenciar")).toBe(true);
    for (const a of [coord, assessor, consulta]) {
      expect(pode(a, "usuarios:gerenciar")).toBe(false);
      expect(pode(a, "lgpd:anonimizar")).toBe(false);
    }
  });
  it("coordenação vê auditoria; assessor e consulta não", () => {
    expect(pode(coord, "auditoria:ver")).toBe(true);
    expect(pode(assessor, "auditoria:ver")).toBe(false);
    expect(pode(consulta, "auditoria:ver")).toBe(false);
  });
  it("consulta é somente leitura", () => {
    expect(MATRIZ.CONSULTA.filter((p) => /criar|editar|gerenciar|anonimizar/.test(p))).toEqual([]);
  });
  it("sem usuário não há permissão", () => {
    expect(pode(null, "dados:ver")).toBe(false);
    expect(() => exigir(undefined, "dados:ver")).toThrow(AppError);
  });
  it("exigir lança PROIBIDO", () => {
    try {
      exigir(consulta, "dados:criar");
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("PROIBIDO");
    }
  });
});

describe("edição e contato em registros com dono", () => {
  const doAssessor = { responsavelId: "s", criadoPorId: "x" };
  const deOutro = { responsavelId: "y", criadoPorId: "x" };
  it("assessor edita só os seus", () => {
    expect(podeEditarRegistro(assessor, doAssessor)).toBe(true);
    expect(podeEditarRegistro(assessor, { responsavelId: null, criadoPorId: "s" })).toBe(true);
    expect(podeEditarRegistro(assessor, deOutro)).toBe(false);
  });
  it("coordenação e admin editam tudo; consulta nada", () => {
    expect(podeEditarRegistro(coord, deOutro)).toBe(true);
    expect(podeEditarRegistro(admin, deOutro)).toBe(true);
    expect(podeEditarRegistro(consulta, { responsavelId: "q" })).toBe(false);
  });
  it("contato do cidadão: mascarado para consulta e para assessor fora dos seus", () => {
    expect(podeVerContato(assessor, doAssessor)).toBe(true);
    expect(podeVerContato(assessor, deOutro)).toBe(false);
    expect(podeVerContato(consulta, { responsavelId: "q" })).toBe(false);
    expect(podeVerContato(coord, deOutro)).toBe(true);
  });
});

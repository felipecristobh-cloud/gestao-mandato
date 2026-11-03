import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco } from "../setup/db";
import { BAIRROS, ORGAOS, REGIONAIS, TEMAS, semearCadastrosBase } from "../../prisma/cadastros-base";

const totalBairros = Object.values(BAIRROS).flat().length;

beforeEach(async () => {
  await limparBanco();
});

describe("cadastros base", () => {
  it("cria regionais, bairros, temas e órgãos num banco vazio", async () => {
    expect(await semearCadastrosBase(db)).toEqual({
      regionais: REGIONAIS.length, bairros: totalBairros, temas: TEMAS.length, orgaos: ORGAOS.length,
    });
    expect(Object.keys(BAIRROS).sort()).toEqual(REGIONAIS.map(([c]) => c).sort());
    expect(totalBairros).toBeGreaterThan(400);
    expect(await db.tema.count({ where: { ativo: true } })).toBe(14);
    expect(await db.bairro.count({ where: { latitude: null } })).toBe(0);
  });

  it("é idempotente e não altera o que já existe", async () => {
    await semearCadastrosBase(db);
    await db.tema.update({ where: { nome: "Cultura" }, data: { ativo: false } });
    await db.tema.delete({ where: { nome: "Outros" } });
    expect(await semearCadastrosBase(db)).toEqual({ regionais: 0, bairros: 0, temas: 1, orgaos: 0 });
    expect((await db.tema.findUniqueOrThrow({ where: { nome: "Cultura" } })).ativo).toBe(false);
  });
});

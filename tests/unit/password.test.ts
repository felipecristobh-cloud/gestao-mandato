import { describe, expect, it } from "vitest";
import { hashSenha, verificarSenha, validarPoliticaSenha, gerarSenhaTemporaria } from "@/server/auth/password";
import { sanitizar, diferenca } from "@/server/audit";
import { mascararEmail, mascararTelefone } from "@/lib/mascara";

describe("senhas", () => {
  it("hash argon2 verifica a senha certa e rejeita a errada", async () => {
    const h = await hashSenha("SenhaForte123");
    expect(h.startsWith("$argon2")).toBe(true);
    expect(await verificarSenha(h, "SenhaForte123")).toBe(true);
    expect(await verificarSenha(h, "outra")).toBe(false);
    expect(await verificarSenha("lixo", "x")).toBe(false);
  });
  it("política exige 10+ caracteres com letras e números", () => {
    expect(validarPoliticaSenha("curta1")).not.toBeNull();
    expect(validarPoliticaSenha("somenteletras")).not.toBeNull();
    expect(validarPoliticaSenha("1234567890")).not.toBeNull();
    expect(validarPoliticaSenha("Mandato2026bh")).toBeNull();
  });
  it("senha temporária respeita a política", () => {
    for (let i = 0; i < 50; i++) expect(validarPoliticaSenha(gerarSenhaTemporaria())).toBeNull();
  });
});

describe("auditoria e máscaras", () => {
  it("nunca grava hash de senha", () => {
    expect(sanitizar({ nome: "A", senhaHash: "x", sub: { token: "t", ok: 1 } })).toEqual({ nome: "A", sub: { ok: 1 } });
  });
  it("diferença registra só o que mudou", () => {
    expect(diferenca({ a: 1, b: "x" }, { a: 1, b: "y" })).toEqual({ anterior: { b: "x" }, novo: { b: "y" }, mudou: true });
    expect(diferenca({ a: 1 }, { a: 1 }).mudou).toBe(false);
  });
  it("mascara telefone e e-mail", () => {
    expect(mascararTelefone("(31) 99876-5432")).toBe("(••) •••••-5432");
    expect(mascararEmail("maria@exemplo.com")).toBe("m•••@exemplo.com");
  });
});

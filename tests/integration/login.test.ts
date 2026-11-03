import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste } from "../setup/db";
import { autenticar, MAX_TENTATIVAS } from "@/server/auth/login";
import { autenticarGoogle } from "@/server/auth/google";
import { validarSessao, encerrarSessao, hashToken } from "@/server/auth/session";

beforeEach(limparBanco);

describe("login", () => {
  it("credenciais corretas criam sessão e registram LOGIN", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, u.email.toUpperCase(), "SenhaForte123");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await validarSessao(db, r.token);
    expect(s?.id).toBe(u.id);
    expect(await db.sessao.findUnique({ where: { id: r.token } })).toBeNull(); // token cru não fica no banco
    expect(await db.sessao.findUnique({ where: { id: hashToken(r.token) } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { acao: "LOGIN", usuarioId: u.id } })).toBe(1);
  });

  it("senha errada não cria sessão e registra falha", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, u.email, "errada");
    expect(r).toEqual({ ok: false, motivo: "CREDENCIAIS" });
    expect(await db.sessao.count()).toBe(0);
    expect(await db.auditLog.count({ where: { acao: "LOGIN_FALHA" } })).toBe(1);
  });

  it("e-mail inexistente e usuário inativo dão a mesma resposta", async () => {
    const inativo = await criarUsuarioTeste("ASSESSOR", { ativo: false });
    expect(await autenticar(db, "ninguem@teste.local", "SenhaForte123")).toEqual({ ok: false, motivo: "CREDENCIAIS" });
    expect(await autenticar(db, inativo.email, "SenhaForte123")).toEqual({ ok: false, motivo: "CREDENCIAIS" });
  });

  it(`bloqueia após ${MAX_TENTATIVAS} tentativas, mesmo com a senha certa depois`, async () => {
    const u = await criarUsuarioTeste("COORDENACAO");
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) expect((await autenticar(db, u.email, "x")).ok).toBe(false);
    expect(await autenticar(db, u.email, "x")).toEqual({ ok: false, motivo: "BLOQUEADO" });
    expect(await autenticar(db, u.email, "SenhaForte123")).toEqual({ ok: false, motivo: "BLOQUEADO" });
    await db.usuario.update({ where: { id: u.id }, data: { bloqueadoAte: new Date(Date.now() - 1000) } });
    expect((await autenticar(db, u.email, "SenhaForte123")).ok).toBe(true);
  });
});

describe("sessão", () => {
  it("usuário desativado perde o acesso na próxima requisição", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, u.email, "SenhaForte123");
    if (!r.ok) throw new Error("login falhou");
    await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
    expect(await validarSessao(db, r.token)).toBeNull();
    expect(await db.sessao.count()).toBe(0);
  });

  it("sessão vencida é rejeitada e apagada", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, u.email, "SenhaForte123");
    if (!r.ok) throw new Error("login falhou");
    await db.sessao.updateMany({ data: { expiraEm: new Date(Date.now() - 1) } });
    expect(await validarSessao(db, r.token)).toBeNull();
    expect(await db.sessao.count()).toBe(0);
  });

  it("logout encerra a sessão; token inventado não vale", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, u.email, "SenhaForte123");
    if (!r.ok) throw new Error("login falhou");
    await encerrarSessao(db, r.token);
    expect(await validarSessao(db, r.token)).toBeNull();
    expect(await validarSessao(db, "inventado")).toBeNull();
  });
});

describe("login com Google", () => {
  it("conta ativa entra e registra LOGIN", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticarGoogle(db, u.email, { ip: "10.0.0.9" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await validarSessao(db, r.token))?.id).toBe(u.id);
    expect(await db.auditLog.count({ where: { acao: "LOGIN", usuarioId: u.id, descricao: "Google" } })).toBe(1);
  });

  it("e-mail sem cadastro ou conta inativa não entra", async () => {
    const inativo = await criarUsuarioTeste("ASSESSOR", { ativo: false });
    expect(await autenticarGoogle(db, "estranho@gmail.com")).toEqual({ ok: false, motivo: "NAO_CADASTRADO" });
    expect(await autenticarGoogle(db, inativo.email)).toEqual({ ok: false, motivo: "NAO_CADASTRADO" });
    expect(await db.sessao.count()).toBe(0);
    expect(await db.usuario.count()).toBe(1);
  });

  it("senha provisória é invalidada e a troca deixa de ser exigida", async () => {
    const u = await criarUsuarioTeste("CONSULTA", { trocarSenha: true });
    const r = await autenticarGoogle(db, u.email);
    expect(r.ok).toBe(true);
    const depois = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(depois.trocarSenha).toBe(false);
    expect((await autenticar(db, u.email, "SenhaForte123")).ok).toBe(false);
  });

  it("conta bloqueada continua bloqueada pelo Google", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    await db.usuario.update({ where: { id: u.id }, data: { bloqueadoAte: new Date(Date.now() + 60_000) } });
    expect(await autenticarGoogle(db, u.email)).toEqual({ ok: false, motivo: "BLOQUEADO" });
  });
});

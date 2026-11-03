import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste } from "../setup/db";
import { criarUsuario, atualizarUsuario, listarUsuarios, redefinirSenha, trocarPropriaSenha, listarAuditoria } from "@/server/services/usuarios";
import { autenticar } from "@/server/auth/login";
import { validarSessao } from "@/server/auth/session";
import type { AppError } from "@/server/errors";

beforeEach(limparBanco);

async function erroDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AppError).code;
  }
  return "SEM_ERRO";
}

const novo = { nome: "Fulana de Teste", email: "Fulana@Teste.local", perfil: "ASSESSOR" as const };

describe("usuários — permissões no servidor", () => {
  it("só admin lista, cria, edita e redefine senha", async () => {
    const alvo = await criarUsuarioTeste("ASSESSOR");
    for (const perfil of ["COORDENACAO", "ASSESSOR", "CONSULTA"] as const) {
      const ator = await criarUsuarioTeste(perfil);
      expect(await erroDe(listarUsuarios(db, ator))).toBe("PROIBIDO");
      expect(await erroDe(criarUsuario(db, ator, { ...novo, email: `${perfil}@x.local` }))).toBe("PROIBIDO");
      expect(await erroDe(atualizarUsuario(db, ator, alvo.id, { ...novo, email: alvo.email, ativo: false }))).toBe("PROIBIDO");
      expect(await erroDe(redefinirSenha(db, ator, alvo.id))).toBe("PROIBIDO");
    }
    expect(await db.usuario.count()).toBe(4);
  });

  it("assessor e consulta não veem auditoria; coordenação vê", async () => {
    expect(await erroDe(listarAuditoria(db, await criarUsuarioTeste("ASSESSOR")))).toBe("PROIBIDO");
    expect(await erroDe(listarAuditoria(db, await criarUsuarioTeste("CONSULTA")))).toBe("PROIBIDO");
    expect(await erroDe(listarAuditoria(db, await criarUsuarioTeste("COORDENACAO")))).toBe("SEM_ERRO");
  });
});

describe("usuários — regras", () => {
  it("cria com senha temporária, troca obrigatória e auditoria sem hash", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    const { usuario, senhaTemporaria } = await criarUsuario(db, admin, novo);
    expect(usuario.email).toBe("fulana@teste.local");
    const r = await autenticar(db, usuario.email, senhaTemporaria);
    expect(r.ok && r.trocarSenha).toBe(true);
    const log = await db.auditLog.findFirst({ where: { acao: "CRIAR", registroId: usuario.id } });
    expect(log?.usuarioId).toBe(admin.id);
    expect(JSON.stringify(log?.valorNovo)).not.toContain("argon2");
  });

  it("valida dados no servidor e impede e-mail duplicado", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    expect(await erroDe(criarUsuario(db, admin, { ...novo, email: "invalido" }))).toBe("VALIDACAO");
    expect(await erroDe(criarUsuario(db, admin, { ...novo, perfil: "SUPER" as never }))).toBe("VALIDACAO");
    await criarUsuario(db, admin, novo);
    expect(await erroDe(criarUsuario(db, admin, novo))).toBe("CONFLITO");
  });

  it("desativar encerra as sessões e registra antes/depois", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    const alvo = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, alvo.email, "SenhaForte123");
    if (!r.ok) throw new Error();
    await atualizarUsuario(db, admin, alvo.id, { nome: alvo.nome, email: alvo.email, perfil: "ASSESSOR", ativo: false });
    expect(await validarSessao(db, r.token)).toBeNull();
    const log = await db.auditLog.findFirst({ where: { acao: "EDITAR", registroId: alvo.id } });
    expect(log?.valorAnterior).toEqual({ ativo: true });
    expect(log?.valorNovo).toEqual({ ativo: false });
  });

  it("não deixa o sistema sem administrador nem o admin se rebaixar", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    expect(await erroDe(atualizarUsuario(db, admin, admin.id, { nome: admin.nome, email: admin.email, perfil: "CONSULTA", ativo: true }))).toBe("VALIDACAO");
    const outroAdmin = await criarUsuarioTeste("ADMIN");
    await atualizarUsuario(db, admin, outroAdmin.id, { nome: outroAdmin.nome, email: outroAdmin.email, perfil: "ASSESSOR", ativo: true });
    expect((await db.usuario.findUnique({ where: { id: outroAdmin.id } }))?.perfil).toBe("ASSESSOR");
  });

  it("apagar telefone e cargo grava vazio", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    const { usuario } = await criarUsuario(db, admin, { ...novo, telefone: "(31) 99999-0000", cargo: "Assessora" });
    const u = await atualizarUsuario(db, admin, usuario.id, { ...novo, email: usuario.email, telefone: "", cargo: "  ", ativo: true });
    expect(u.telefone).toBeNull();
    expect(u.cargo).toBeNull();
  });

  it("rebaixamentos simultâneos não zeram os administradores", async () => {
    const a = await criarUsuarioTeste("ADMIN");
    const b = await criarUsuarioTeste("ADMIN");
    const rebaixar = (ator: typeof a, alvo: typeof a) =>
      erroDe(atualizarUsuario(db, ator, alvo.id, { nome: alvo.nome, email: alvo.email, perfil: "ASSESSOR", ativo: true }));
    const r = await Promise.all([rebaixar(a, b), rebaixar(b, a)]);
    expect(r.sort()).toEqual(["SEM_ERRO", "VALIDACAO"]);
    expect(await db.usuario.count({ where: { perfil: "ADMIN", ativo: true } })).toBe(1);
  });

  it("redefinir senha derruba sessões e desbloqueia", async () => {
    const admin = await criarUsuarioTeste("ADMIN");
    const alvo = await criarUsuarioTeste("ASSESSOR");
    const r = await autenticar(db, alvo.email, "SenhaForte123");
    if (!r.ok) throw new Error();
    const { senhaTemporaria } = await redefinirSenha(db, admin, alvo.id);
    expect(await validarSessao(db, r.token)).toBeNull();
    expect((await autenticar(db, alvo.email, "SenhaForte123")).ok).toBe(false);
    expect((await autenticar(db, alvo.email, senhaTemporaria)).ok).toBe(true);
  });

  it("troca da própria senha exige a atual e a política", async () => {
    const u = await criarUsuarioTeste("ASSESSOR", { trocarSenha: true });
    expect(await erroDe(trocarPropriaSenha(db, u, "errada", "NovaSenha2026"))).toBe("VALIDACAO");
    expect(await erroDe(trocarPropriaSenha(db, u, "SenhaForte123", "fraca"))).toBe("VALIDACAO");
    await trocarPropriaSenha(db, u, "SenhaForte123", "NovaSenha2026");
    const r = await autenticar(db, u.email, "NovaSenha2026");
    expect(r.ok && r.trocarSenha).toBe(false);
  });
});

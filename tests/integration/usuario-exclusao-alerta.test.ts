import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { excluirUsuario, listarUsuarios } from "@/server/services/usuarios";
import { criarDemanda } from "@/server/services/demandas";
import * as email from "@/server/email";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };
let admin: Ator;
let assessor: Ator;

beforeEach(async () => {
  await limparBanco();
  admin = await criarUsuarioTeste("ADMIN");
  assessor = await criarUsuarioTeste("ASSESSOR");
});
afterEach(() => vi.restoreAllMocks());

describe("excluir usuário", () => {
  it("sai da lista, perde acesso, libera o e-mail e mantém o nome no histórico", async () => {
    const antes = await db.usuario.findUniqueOrThrow({ where: { id: assessor.id } });
    await db.sessao.create({ data: { id: "s".repeat(64), usuarioId: assessor.id, expiraEm: new Date(Date.now() + 1e6) } });
    await excluirUsuario(db, admin, assessor.id);
    const u = await db.usuario.findUniqueOrThrow({ where: { id: assessor.id } });
    expect(u.ativo).toBe(false);
    expect(u.excluidoEm).not.toBeNull();
    expect(u.nome).toBe(antes.nome);
    expect(u.email).not.toBe(antes.email);
    expect(await db.sessao.count({ where: { usuarioId: assessor.id } })).toBe(0);
    expect((await listarUsuarios(db, admin)).map((x) => x.id)).not.toContain(assessor.id);
    expect(await db.auditLog.count({ where: { entidade: "usuario", registroId: assessor.id, acao: "EXCLUIR" } })).toBe(1);
    await expect(excluirUsuario(db, admin, admin.id)).rejects.toThrow(/próprio/);
    await expect(excluirUsuario(db, assessor, admin.id)).rejects.toThrow();
  });
});

describe("alerta por e-mail", () => {
  it("avisa o responsável quando outra pessoa atribui a demanda, sem dados do cidadão", async () => {
    const base = await criarBase();
    const envio = vi.spyOn(email, "avisarResponsavelDemanda").mockResolvedValue(true);
    const dados = { solicitanteNome: "Maria Fictícia", telefone: "31999990000", bairroId: String(base.bairro.id), temaId: String(base.tema.id), tipo: "SOLICITACAO", prioridade: "MEDIA", descricao: "Descrição fictícia" };
    const d = await criarDemanda(db, admin, { ...dados, responsavelId: assessor.id } as never);
    expect(envio).toHaveBeenCalledTimes(1);
    const [, info] = envio.mock.calls[0];
    expect(info).toMatchObject({ protocolo: d.protocolo, tema: base.tema.nome });
    expect(JSON.stringify(envio.mock.calls[0])).not.toMatch(/Maria|31999990000/);
    await criarDemanda(db, assessor, { ...dados, responsavelId: assessor.id } as never);
    expect(envio).toHaveBeenCalledTimes(1);
  });
});

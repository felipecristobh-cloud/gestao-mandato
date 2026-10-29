import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import { autenticar, MAX_FALHAS_IP } from "@/server/auth/login";
import { storageLocal, type Storage } from "@/server/storage";
import { baixarDocumento, documentosDe, enviarDocumento, listarDocumentos, removerDocumento } from "@/server/services/documentos";
import { anonimizarPessoa, NOME_ANONIMIZADO } from "@/server/services/lgpd";
import { registrarAuditoria } from "@/server/audit";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };
let base: Awaited<ReturnType<typeof criarBase>>;
let admin: Ator, coord: Ator, assessor: Ator, assessor2: Ator, consulta: Ator;
let dir: string;
let storage: Storage;
let seq = 0;

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  [admin, coord, assessor, assessor2, consulta] = await Promise.all(
    (["ADMIN", "COORDENACAO", "ASSESSOR", "ASSESSOR", "CONSULTA"] as const).map((p) => criarUsuarioTeste(p)),
  );
  dir = await mkdtemp(path.join(tmpdir(), "gm-docs-"));
  storage = storageLocal(dir);
});

async function erroDe(p: Promise<unknown>) {
  try { await p; } catch (e) { return (e as AppError).code ?? String(e); }
  return "SEM_ERRO";
}

const PDF = "%PDF-1.7\nconteudo secreto do oficio\n";
const arquivo = (nome = "Ofício 12.pdf", conteudo: string = PDF) => new File([conteudo], nome);

async function demandaDe(dono: Ator, extra: { telefone?: string } = {}) {
  seq += 1;
  const pessoa = await db.pessoa.create({ data: { nome: "Maria Fictícia", telefone: extra.telefone ?? "31999998888", email: "maria@ex.com", endereco: "Rua A, 10" } });
  return db.demanda.create({
    data: {
      protocolo: `DEM-2026-9${String(seq).padStart(4, "0")}`, pessoaId: pessoa.id, temaId: base.tema.id, descricao: "Buraco na rua",
      endereco: "Rua A, 10", latitude: -19.91, longitude: -43.92, responsavelId: dono.id, criadoPorId: dono.id,
    },
  });
}

describe("documentos", () => {
  it("envia criptografado, baixa com auditoria e remove do storage", async () => {
    const d = await demandaDe(assessor);
    const doc = await enviarDocumento(db, assessor, { arquivo: arquivo(), categoria: "OFICIO", vinculo: { tipo: "demanda", id: d.id } }, { ip: "1.1.1.1" }, storage);
    expect(doc.tipo).toBe("application/pdf");
    const [ano] = await readdir(dir);
    const [mes] = await readdir(path.join(dir, ano));
    const [arq] = await readdir(path.join(dir, ano, mes));
    expect((await readFile(path.join(dir, ano, mes, arq))).includes(Buffer.from("secreto"))).toBe(false);
    const b = await baixarDocumento(db, coord, doc.id, {}, storage);
    expect(b.conteudo.toString()).toBe(PDF);
    expect(await db.auditLog.count({ where: { acao: "DOWNLOAD", registroId: doc.id } })).toBe(1);
    await removerDocumento(db, assessor, doc.id, {}, storage);
    expect(await readdir(path.join(dir, ano, mes))).toHaveLength(0);
  });

  it("recusa tipo errado, arquivo vazio e conteúdo disfarçado", async () => {
    expect(await erroDe(enviarDocumento(db, coord, { arquivo: arquivo("virus.exe", "MZ......"), vinculo: null }, {}, storage))).toBe("VALIDACAO");
    expect(await erroDe(enviarDocumento(db, coord, { arquivo: arquivo("falso.pdf", "MZ\x90\x00 executavel"), vinculo: null }, {}, storage))).toBe("VALIDACAO");
    expect(await erroDe(enviarDocumento(db, coord, { arquivo: arquivo("vazio.pdf", ""), vinculo: null }, {}, storage))).toBe("VALIDACAO");
    expect(await db.documento.count()).toBe(0);
  });

  it("permissões: Consulta não envia; assessor só anexa no que é dele; restrito só Admin/Coordenação", async () => {
    const dOutro = await demandaDe(assessor2);
    expect(await erroDe(enviarDocumento(db, consulta, { arquivo: arquivo(), vinculo: null }, {}, storage))).toBe("PROIBIDO");
    expect(await erroDe(enviarDocumento(db, assessor, { arquivo: arquivo(), vinculo: { tipo: "demanda", id: dOutro.id } }, {}, storage))).toBe("PROIBIDO");
    expect(await erroDe(enviarDocumento(db, assessor, { arquivo: arquivo(), restrito: true, vinculo: null }, {}, storage))).toBe("PROIBIDO");
    const restrito = await enviarDocumento(db, coord, { arquivo: arquivo("parecer.pdf"), restrito: true, vinculo: null }, {}, storage);
    expect(await erroDe(baixarDocumento(db, assessor, restrito.id, {}, storage))).toBe("NAO_ENCONTRADO");
    expect((await listarDocumentos(db, consulta)).itens.map((d) => d.id)).not.toContain(restrito.id);
    expect((await listarDocumentos(db, admin)).itens.map((d) => d.id)).toContain(restrito.id);
  });

  it("anexo de demanda segue a regra do contato: Consulta e outro assessor não abrem nem veem o nome", async () => {
    const d = await demandaDe(assessor);
    const doc = await enviarDocumento(db, assessor, { arquivo: arquivo("RG Maria.pdf"), vinculo: { tipo: "demanda", id: d.id } }, {}, storage);
    expect(await erroDe(baixarDocumento(db, consulta, doc.id, {}, storage))).toBe("PROIBIDO");
    expect(await erroDe(baixarDocumento(db, assessor2, doc.id, {}, storage))).toBe("PROIBIDO");
    const [visto] = await documentosDe(db, consulta, { tipo: "demanda", id: d.id });
    expect(visto.podeAbrir).toBe(false);
    expect(JSON.stringify(visto)).not.toContain("Maria");
    expect((await listarDocumentos(db, consulta, { q: "Maria" })).total).toBe(0);
    expect(await erroDe(removerDocumento(db, assessor2, doc.id, {}, storage))).toBe("PROIBIDO");
  });
});

describe("LGPD — anonimização", () => {
  it("só Admin; apaga dados pessoais, anexos e limpa a auditoria", async () => {
    const d = await demandaDe(assessor);
    await registrarAuditoria(db, { usuarioId: assessor.id, entidade: "pessoa", registroId: d.pessoaId, acao: "CRIAR", valorNovo: { nome: "Maria Fictícia", telefone: "31999998888" } });
    const doc = await enviarDocumento(db, assessor, { arquivo: arquivo("RG Maria.pdf"), vinculo: { tipo: "demanda", id: d.id } }, {}, storage);
    expect(await erroDe(anonimizarPessoa(db, coord, d.pessoaId, "pedido do titular", {}, storage))).toBe("PROIBIDO");
    expect(await erroDe(anonimizarPessoa(db, admin, d.pessoaId, "x", {}, storage))).toBe("VALIDACAO");
    const r = await anonimizarPessoa(db, admin, d.pessoaId, "pedido do titular por e-mail", {}, storage);
    expect(r).toEqual({ demandas: 1, arquivos: 1 });
    const p = await db.pessoa.findUniqueOrThrow({ where: { id: d.pessoaId } });
    expect(p).toMatchObject({ nome: NOME_ANONIMIZADO, telefone: null, email: null, endereco: null });
    expect(await db.demanda.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ endereco: null, latitude: null, longitude: null, protocolo: d.protocolo });
    expect(await db.documento.findUnique({ where: { id: doc.id } })).toBeNull();
    const logs = JSON.stringify(await db.auditLog.findMany());
    expect(logs).not.toContain("Maria");
    expect(logs).not.toContain("8888");
    expect(await db.auditLog.count({ where: { acao: "ANONIMIZAR", registroId: d.pessoaId } })).toBe(1);
    expect(await erroDe(anonimizarPessoa(db, admin, d.pessoaId, "de novo, pedido", {}, storage))).toBe("VALIDACAO");
  });
});

describe("login — reforços", () => {
  it(`bloqueia o IP depois de ${MAX_FALHAS_IP} falhas, sem afetar outro IP`, async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    await db.auditLog.createMany({ data: Array.from({ length: MAX_FALHAS_IP }, () => ({ entidade: "usuario", acao: "LOGIN_FALHA" as const, ip: "9.9.9.9" })) });
    expect(await autenticar(db, u.email, "SenhaForte123", { ip: "9.9.9.9" })).toEqual({ ok: false, motivo: "BLOQUEADO_IP" });
    expect((await autenticar(db, u.email, "SenhaForte123", { ip: "8.8.8.8" })).ok).toBe(true);
  });

  it("conta desativada durante o login não ganha sessão", async () => {
    const u = await criarUsuarioTeste("ASSESSOR");
    const login = autenticar(db, u.email, "SenhaForte123");
    await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
    expect(await login).toEqual({ ok: false, motivo: "CREDENCIAIS" });
    expect(await db.sessao.count({ where: { usuarioId: u.id } })).toBe(0);
  });
});

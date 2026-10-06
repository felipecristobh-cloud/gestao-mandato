import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  alterarStatus, atualizarDemanda, buscarSemelhantes, comentarDemanda, contadoresDemandas, criarDemanda,
  encaminharDemanda, listarDemandas, obterDemanda, registrarRetorno,
} from "@/server/services/demandas";
import { deISO, hojeISO, somarDias } from "@/lib/demandas";
import type { AppError } from "@/server/errors";

let base: Awaited<ReturnType<typeof criarBase>>;
beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
});

async function erroDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AppError).code;
  }
  return "SEM_ERRO";
}

const entrada = (extra: Record<string, unknown> = {}) => ({
  solicitanteNome: "Joana Fictícia",
  telefone: "(31) 98888-1234",
  email: "joana@exemplo.local",
  endereco: "Rua Fictícia, 100",
  bairroId: String(base.bairro.id),
  temaId: String(base.tema.id),
  tipo: "SOLICITACAO",
  descricao: "Buraco grande na pista em frente à escola.",
  prioridade: "ALTA",
  prazo: "",
  responsavelId: "",
  orgaoId: "",
  observacoes: "",
  ...extra,
});

describe("demandas — cadastro", () => {
  it("gera protocolo sequencial, cria solicitante, histórico e auditoria", async () => {
    const ator = await criarUsuarioTeste("ASSESSOR");
    const d1 = await criarDemanda(db, ator, entrada());
    const d2 = await criarDemanda(db, ator, entrada({ solicitanteNome: "Outra Pessoa", telefone: "" }));
    const ano = hojeISO().slice(0, 4);
    expect(d1.protocolo).toBe(`DEM-${ano}-00001`);
    expect(d2.protocolo).toBe(`DEM-${ano}-00002`);
    expect(d1.status).toBe("NOVA");
    expect(d1.criadoPorId).toBe(ator.id);
    expect(await db.pessoa.count()).toBe(2);
    expect(await db.demandaHistorico.count({ where: { demandaId: d1.id, tipo: "CRIACAO" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entidade: "demanda", acao: "CRIAR" } })).toBe(2);
  });

  it("protocolos não se repetem em cadastros simultâneos", async () => {
    const ator = await criarUsuarioTeste("COORDENACAO");
    const ds = await Promise.all(Array.from({ length: 8 }, (_, i) => criarDemanda(db, ator, entrada({ solicitanteNome: `Pessoa ${i} Teste` }))));
    expect(new Set(ds.map((d) => d.protocolo)).size).toBe(8);
  });

  it("exige solicitante, tema e descrição; rejeita tema inativo e responsável Consulta", async () => {
    const ator = await criarUsuarioTeste("ADMIN");
    const consulta = await criarUsuarioTeste("CONSULTA");
    expect(await erroDe(criarDemanda(db, ator, entrada({ solicitanteNome: "" })))).toBe("VALIDACAO");
    expect(await erroDe(criarDemanda(db, ator, entrada({ temaId: "" })))).toBe("VALIDACAO");
    expect(await erroDe(criarDemanda(db, ator, entrada({ descricao: "curta" })))).toBe("VALIDACAO");
    expect(await erroDe(criarDemanda(db, ator, entrada({ temaId: String(base.temaInativo.id) })))).toBe("VALIDACAO");
    expect(await erroDe(criarDemanda(db, ator, entrada({ responsavelId: consulta.id })))).toBe("VALIDACAO");
    expect(await erroDe(criarDemanda(db, ator, entrada({ prazo: "2026-13-40" })))).toBe("VALIDACAO");
    expect(await db.demanda.count()).toBe(0);
    expect(await db.pessoa.count()).toBe(0);
  });

  it("Consulta não cadastra", async () => {
    expect(await erroDe(criarDemanda(db, await criarUsuarioTeste("CONSULTA"), entrada()))).toBe("PROIBIDO");
  });

  it("pode vincular a um solicitante já cadastrado sem duplicar a pessoa", async () => {
    const ator = await criarUsuarioTeste("ASSESSOR");
    const d1 = await criarDemanda(db, ator, entrada());
    const d2 = await criarDemanda(db, ator, entrada({ pessoaId: d1.pessoaId, descricao: "Outra demanda da mesma pessoa.", endereco: "", bairroId: "" }));
    expect(await db.pessoa.count()).toBe(1);
    expect(d2).toMatchObject({ endereco: "Rua Fictícia, 100", bairroId: base.bairro.id });
  });
});

describe("demandas — duplicidade", () => {
  it("acha semelhantes por telefone, nome e descrição no mesmo bairro", async () => {
    const ator = await criarUsuarioTeste("ASSESSOR");
    await criarDemanda(db, ator, entrada());
    const porTel = await buscarSemelhantes(db, ator, { solicitanteNome: "Nome Diferente", telefone: "31 9 8888 1234" });
    expect(porTel.pessoas).toHaveLength(1);
    expect(porTel.demandas).toHaveLength(1);
    const porNome = await buscarSemelhantes(db, ator, { solicitanteNome: "joana ficticia" });
    expect(porNome.demandas).toHaveLength(1);
    const porDescricao = await buscarSemelhantes(db, ator, {
      solicitanteNome: "Zé", bairroId: base.bairro.id, descricao: "Buraco grande na pista em frente a escola",
    });
    expect(porDescricao.demandas).toHaveLength(1);
    const nada = await buscarSemelhantes(db, ator, { solicitanteNome: "Xavier Ninguém", telefone: "3133334444", descricao: "Poda de árvore" });
    expect(nada).toEqual({ pessoas: [], demandas: [] });
  });

  it("assessor vê o telefone mascarado no alerta; coordenação vê completo", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    await criarDemanda(db, coord, entrada());
    const a = await buscarSemelhantes(db, await criarUsuarioTeste("ASSESSOR"), { telefone: "31988881234" });
    expect(a.pessoas[0].telefone).not.toContain("8888-1234");
    const c = await buscarSemelhantes(db, coord, { telefone: "31988881234" });
    expect(c.pessoas[0].telefone).toBe("(31) 98888-1234");
  });
});

describe("demandas — edição e permissões", () => {
  it("assessor edita só as próprias ou sob sua responsabilidade; coordenação edita todas", async () => {
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const a2 = await criarUsuarioTeste("ASSESSOR");
    const coord = await criarUsuarioTeste("COORDENACAO");
    const d = await criarDemanda(db, coord, entrada());
    expect(await erroDe(atualizarDemanda(db, a1, d.id, entrada({ prioridade: "BAIXA" })))).toBe("PROIBIDO");
    expect(await erroDe(alterarStatus(db, a1, d.id, { status: "EM_ANALISE" }))).toBe("PROIBIDO");
    await atualizarDemanda(db, coord, d.id, entrada({ responsavelId: a1.id }));
    expect(await erroDe(atualizarDemanda(db, a1, d.id, entrada({ responsavelId: a1.id, prioridade: "BAIXA" })))).toBe("SEM_ERRO");
    expect(await erroDe(comentarDemanda(db, a2, d.id, "Oi"))).toBe("PROIBIDO");
    expect(await erroDe(alterarStatus(db, await criarUsuarioTeste("CONSULTA"), d.id, { status: "EM_ANALISE" }))).toBe("PROIBIDO");
  });

  it("registra no histórico os campos alterados e a troca de responsável", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const d = await criarDemanda(db, coord, entrada());
    await atualizarDemanda(db, coord, d.id, entrada({ prioridade: "URGENTE", prazo: "2026-12-01", responsavelId: a1.id, telefone: "" }));
    const h = await db.demandaHistorico.findMany({ where: { demandaId: d.id }, orderBy: { data: "asc" } });
    expect(h.map((x) => x.tipo)).toEqual(["CRIACAO", "EDICAO", "RESPONSAVEL"]);
    expect(h[1].descricao).toContain("prioridade");
    expect(h[1].descricao).toContain("prazo");
    expect(h[1].descricao).toContain("telefone");
    expect(h[2].descricao).toContain(a1.nome);
    expect((await db.pessoa.findFirstOrThrow()).telefone).toBeNull();
    const audit = await db.auditLog.findFirstOrThrow({ where: { entidade: "demanda", acao: "EDITAR" } });
    expect(audit.valorNovo).toMatchObject({ prioridade: "URGENTE", responsavelId: a1.id });
  });

  it("salvar sem mudanças não gera histórico", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const d = await criarDemanda(db, coord, entrada());
    await atualizarDemanda(db, coord, d.id, entrada());
    expect(await db.demandaHistorico.count({ where: { demandaId: d.id } })).toBe(1);
  });
});

describe("demandas — status, encaminhamento e retorno", () => {
  it("mudança de status grava histórico, auditoria e data de conclusão", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const d = await criarDemanda(db, coord, entrada());
    await alterarStatus(db, coord, d.id, { status: "RESOLVIDA", comentario: "Buraco tapado." });
    let atual = await db.demanda.findUniqueOrThrow({ where: { id: d.id } });
    expect(atual.dataConclusao?.toISOString().slice(0, 10)).toBe(hojeISO());
    const h = await db.demandaHistorico.findFirstOrThrow({ where: { demandaId: d.id, tipo: "STATUS" } });
    expect(h).toMatchObject({ statusAnterior: "NOVA", statusNovo: "RESOLVIDA" });
    expect(await db.auditLog.count({ where: { entidade: "demanda", acao: "EDITAR" } })).toBe(1);
    await alterarStatus(db, coord, d.id, { status: "EM_ANDAMENTO" });
    atual = await db.demanda.findUniqueOrThrow({ where: { id: d.id } });
    expect(atual.dataConclusao).toBeNull();
  });

  it("cancelar exige motivo e status igual é rejeitado", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const d = await criarDemanda(db, coord, entrada());
    expect(await erroDe(alterarStatus(db, coord, d.id, { status: "CANCELADA" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatus(db, coord, d.id, { status: "NOVA" }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatus(db, coord, d.id, { status: "INVENTADO" }))).toBe("VALIDACAO");
  });

  it("encaminhar muda Nova → Encaminhada, define órgão; retorno vai pro histórico", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const d = await criarDemanda(db, coord, entrada());
    const e = await encaminharDemanda(db, coord, d.id, { orgaoId: String(base.orgao.id), protocolo: "SAC-123", descricao: "Ofício pedindo reparo.", prazoRetorno: "2026-11-01" });
    let atual = await db.demanda.findUniqueOrThrow({ where: { id: d.id } });
    expect(atual).toMatchObject({ status: "ENCAMINHADA", orgaoId: base.orgao.id });
    await registrarRetorno(db, coord, e.id, { retorno: "Equipe agendada.", dataRetorno: "" });
    const enc = await db.encaminhamento.findUniqueOrThrow({ where: { id: e.id } });
    expect(enc.retorno).toBe("Equipe agendada.");
    expect(enc.dataRetorno?.toISOString().slice(0, 10)).toBe(hojeISO());
    const tipos = (await db.demandaHistorico.findMany({ where: { demandaId: d.id }, orderBy: { data: "asc" } })).map((h) => h.tipo);
    expect(tipos).toEqual(["CRIACAO", "ENCAMINHAMENTO", "RETORNO"]);
    atual = await db.demanda.findUniqueOrThrow({ where: { id: d.id } });
    expect(atual.status).toBe("ENCAMINHADA");
  });
});

describe("demandas — consulta, filtros, prazos e LGPD", () => {
  it("filtra por status, regional, responsável, busca e prazo", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const hoje = hojeISO();
    const atrasada = await criarDemanda(db, coord, entrada({ prazo: somarDias(hoje, -2), responsavelId: a1.id }));
    await criarDemanda(db, coord, entrada({ prazo: somarDias(hoje, 5), solicitanteNome: "Marcos Exemplo", bairroId: String(base.bairroOeste.id) }));
    await criarDemanda(db, coord, entrada({ prazo: somarDias(hoje, 20), descricao: "Pedido de vaga em creche para criança." }));
    const resolvida = await criarDemanda(db, coord, entrada({ prazo: somarDias(hoje, -30) }));
    await alterarStatus(db, coord, resolvida.id, { status: "RESOLVIDA" });

    const n = async (f: Record<string, string>) => (await listarDemandas(db, coord, f)).total;
    expect(await n({})).toBe(4);
    expect(await n({ prazo: "atrasadas" })).toBe(1);
    expect(await n({ prazo: "7" })).toBe(1);
    expect(await n({ prazo: "30" })).toBe(2);
    expect(await n({ status: "abertas" })).toBe(3);
    expect(await n({ status: "RESOLVIDA" })).toBe(1);
    expect(await n({ regionalId: String(base.outra.id) })).toBe(1);
    expect(await n({ q: "creche" })).toBe(1);
    expect(await n({ q: "marcos" })).toBe(1);
    expect(await n({ q: atrasada.protocolo })).toBe(1);
    expect(await n({ responsavel: "sem" })).toBe(3);
    expect((await listarDemandas(db, a1, { responsavel: "eu" })).total).toBe(1);
    expect(await n({ status: "abertas", prazo: "atrasadas", regionalId: String(base.regional.id) })).toBe(1);

    const c = await contadoresDemandas(db, a1);
    expect(c).toEqual({ abertas: 3, atrasadas: 1, vence7: 1, semResponsavel: 2, minhas: 1 });
    expect(deISO(hoje).getTime()).toBeGreaterThan(0);
  });

  it("assessor vê contato mascarado em demanda de outro; responsável vê completo", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const a2 = await criarUsuarioTeste("ASSESSOR");
    const d = await criarDemanda(db, coord, entrada({ responsavelId: a1.id }));
    const deA2 = await obterDemanda(db, a2, d.id);
    expect(deA2.contatoVisivel).toBe(false);
    expect(deA2.podeEditar).toBe(false);
    expect(deA2.pessoa.telefone).not.toBe("(31) 98888-1234");
    expect(deA2.pessoa.email).not.toBe("joana@exemplo.local");
    const deA1 = await obterDemanda(db, a1, d.id);
    expect(deA1.pessoa.telefone).toBe("(31) 98888-1234");
    expect(deA1.podeEditar).toBe(true);
    const deConsulta = await obterDemanda(db, await criarUsuarioTeste("CONSULTA"), d.id);
    expect(deConsulta.contatoVisivel).toBe(false);
  });
});

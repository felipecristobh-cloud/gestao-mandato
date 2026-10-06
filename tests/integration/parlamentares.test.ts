import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  atualizarMandato, atualizarParlamentar, criarMandato, criarParlamentar, desvincularMandato, excluirMandato, listarParlamentares,
  obterParlamentar, opcoesMandatosParceiros, vincularMandato,
} from "@/server/services/parlamentares";
import { criarDemanda, obterDemanda } from "@/server/services/demandas";
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

const parl = (extra: Record<string, unknown> = {}) => ({ nome: "Deputada Exemplo", cargo: "DEPUTADO_ESTADUAL", partido: "PFA", municipio: "Belo Horizonte", uf: "mg", ...extra });
const mand = (inicio: string, fim: string, extra: Record<string, unknown> = {}) => ({ cargo: "DEPUTADO_ESTADUAL", dataInicio: inicio, dataFim: fim, ...extra });

async function demandaDe(ator: { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" }) {
  return criarDemanda(db, ator, {
    solicitanteNome: "Joana Fictícia", temaId: String(base.tema.id), tipo: "SOLICITACAO", descricao: "Pedido fictício de recapeamento.",
    prioridade: "MEDIA", bairroId: String(base.bairro.id),
  });
}

describe("parlamentares — cadastro e permissões", () => {
  it("cria com esfera derivada do cargo, UF normalizada e auditoria", async () => {
    const ator = await criarUsuarioTeste("ASSESSOR");
    const p = await criarParlamentar(db, ator, parl({ esfera: "FEDERAL" }));
    expect(p.esfera).toBe("ESTADUAL");
    expect(p.uf).toBe("MG");
    expect(p.ativo).toBe(true);
    expect(p.proprio).toBe(false);
    expect(await db.auditLog.count({ where: { entidade: "parlamentar", registroId: p.id, acao: "CRIAR" } })).toBe(1);
  });

  it("rejeita nome repetido (sem diferenciar maiúsculas), UF inválida e Consulta", async () => {
    const ator = await criarUsuarioTeste("COORDENACAO");
    await criarParlamentar(db, ator, parl());
    expect(await erroDe(criarParlamentar(db, ator, parl({ nome: "DEPUTADA EXEMPLO" })))).toBe("CONFLITO");
    expect(await erroDe(criarParlamentar(db, ator, parl({ nome: "Outro Nome", uf: "XX" })))).toBe("VALIDACAO");
    const consulta = await criarUsuarioTeste("CONSULTA");
    expect(await erroDe(criarParlamentar(db, consulta, parl({ nome: "Mais Um" })))).toBe("PROIBIDO");
  });

  it("só admin/coordenação definem o mandato próprio, e só pode haver um", async () => {
    const assessor = await criarUsuarioTeste("ASSESSOR");
    const coord = await criarUsuarioTeste("COORDENACAO");
    expect(await erroDe(criarParlamentar(db, assessor, parl({ nome: "Titular", cargo: "VEREADOR", proprio: "on" })))).toBe("PROIBIDO");
    const titular = await criarParlamentar(db, coord, parl({ nome: "Titular", cargo: "VEREADOR", proprio: "on" }));
    expect(titular.proprio).toBe(true);
    expect(await erroDe(criarParlamentar(db, coord, parl({ nome: "Outro Titular", proprio: "on" })))).toBe("CONFLITO");
    const outro = await criarParlamentar(db, coord, parl({ nome: "Outro" }));
    expect(await erroDe(atualizarParlamentar(db, coord, outro.id, parl({ nome: "Outro", proprio: "on" })))).toBe("CONFLITO");
  });

  it("assessor edita só o que cadastrou; edição audita só o que mudou", async () => {
    const a1 = await criarUsuarioTeste("ASSESSOR");
    const a2 = await criarUsuarioTeste("ASSESSOR");
    const p = await criarParlamentar(db, a1, parl());
    expect(await erroDe(atualizarParlamentar(db, a2, p.id, parl({ partido: "PFZ" })))).toBe("PROIBIDO");
    const editado = await atualizarParlamentar(db, a1, p.id, parl({ partido: "PFZ", ativo: "" }));
    expect(editado.partido).toBe("PFZ");
    expect(editado.ativo).toBe(false);
    const log = await db.auditLog.findFirstOrThrow({ where: { entidade: "parlamentar", acao: "EDITAR" } });
    expect(Object.keys(log.valorNovo as object).sort()).toEqual(["ativo", "partido"]);
  });

  it("lista com busca e filtros (ativos por padrão)", async () => {
    const ator = await criarUsuarioTeste("COORDENACAO");
    await criarParlamentar(db, ator, parl());
    await criarParlamentar(db, ator, parl({ nome: "Senador Exemplo", cargo: "SENADOR", partido: "PFC" }));
    await criarParlamentar(db, ator, parl({ nome: "Ex-vereador", cargo: "VEREADOR", ativo: "" }));
    expect((await listarParlamentares(db, ator)).total).toBe(2);
    expect((await listarParlamentares(db, ator, { situacao: "inativos" })).itens.map((p) => p.nome)).toEqual(["Ex-vereador"]);
    expect((await listarParlamentares(db, ator, { situacao: "todos" })).total).toBe(3);
    expect((await listarParlamentares(db, ator, { esfera: "FEDERAL" })).itens.map((p) => p.nome)).toEqual(["Senador Exemplo"]);
    expect((await listarParlamentares(db, ator, { q: "pfc" })).total).toBe(1);
    expect((await listarParlamentares(db, ator, { cargo: "DEPUTADO_ESTADUAL" })).total).toBe(1);
  });
});

describe("mandatos", () => {
  it("permite vários mandatos, bloqueia sobreposição e fim antes do início", async () => {
    const ator = await criarUsuarioTeste("COORDENACAO");
    const p = await criarParlamentar(db, ator, parl());
    const m1 = await criarMandato(db, ator, p.id, mand("2019-02-01", "2023-01-31", { legislatura: "19ª" }));
    await criarMandato(db, ator, p.id, mand("2023-02-01", "2027-01-31", { legislatura: "20ª" }));
    expect(m1.partido).toBe("PFA");
    expect(m1.municipio).toBe("Belo Horizonte");
    expect(await erroDe(criarMandato(db, ator, p.id, mand("2022-06-01", "2024-01-01")))).toBe("VALIDACAO");
    expect(await erroDe(criarMandato(db, ator, p.id, mand("2010-01-01", "")))).toBe("VALIDACAO");
    expect(await erroDe(criarMandato(db, ator, p.id, mand("2030-01-01", "2029-01-01")))).toBe("VALIDACAO");
    expect(await erroDe(criarMandato(db, ator, p.id, mand("", "2029-01-01")))).toBe("VALIDACAO");
    // editar o próprio período não conflita consigo mesmo
    const ed = await atualizarMandato(db, ator, m1.id, mand("2019-02-01", "2023-01-31", { legislatura: "19ª legislatura" }));
    expect(ed.legislatura).toBe("19ª legislatura");
    expect(await erroDe(atualizarMandato(db, ator, m1.id, mand("2019-02-01", "2023-02-01")))).toBe("VALIDACAO");
    // o mesmo período em outro parlamentar é permitido
    const outro = await criarParlamentar(db, ator, parl({ nome: "Outra Pessoa" }));
    await criarMandato(db, ator, outro.id, mand("2019-02-01", "2023-01-31"));
    const detalhe = await obterParlamentar(db, ator, p.id);
    expect(detalhe.mandatos).toHaveLength(2);
    expect(detalhe.historico.filter((h) => h.entidade === "mandato")).toHaveLength(3);
  });

  it("assessor não mexe nos mandatos de parlamentar de outro", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const assessor = await criarUsuarioTeste("ASSESSOR");
    const p = await criarParlamentar(db, coord, parl());
    expect(await erroDe(criarMandato(db, assessor, p.id, mand("2023-02-01", "2027-01-31")))).toBe("PROIBIDO");
    const m = await criarMandato(db, coord, p.id, mand("2023-02-01", "2027-01-31"));
    expect(await erroDe(excluirMandato(db, assessor, m.id))).toBe("PROIBIDO");
  });
});

describe("vínculo demanda ↔ mandato", () => {
  it("vincula parceiro, nunca autoria nem o mandato próprio; registra histórico", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const titular = await criarParlamentar(db, coord, parl({ nome: "Titular", cargo: "VEREADOR", proprio: "on" }));
    const mProprio = await criarMandato(db, coord, titular.id, mand("2025-01-01", "2028-12-31", { cargo: "VEREADOR" }));
    const parceiro = await criarParlamentar(db, coord, parl());
    const m = await criarMandato(db, coord, parceiro.id, mand("2023-02-01", "2027-01-31"));
    const d = await demandaDe(coord);

    expect(await erroDe(vincularMandato(db, coord, d.id, { mandatoId: m.id, tipo: "AUTOR" }))).toBe("VALIDACAO");
    expect(await erroDe(vincularMandato(db, coord, d.id, { mandatoId: m.id, tipo: "COAUTOR" }))).toBe("VALIDACAO");
    expect(await erroDe(vincularMandato(db, coord, d.id, { mandatoId: mProprio.id, tipo: "ARTICULADOR" }))).toBe("VALIDACAO");

    const v = await vincularMandato(db, coord, d.id, { mandatoId: m.id, tipo: "ARTICULADOR", observacoes: "Reunião no gabinete" });
    await vincularMandato(db, coord, d.id, { mandatoId: m.id, tipo: "ACOMPANHAMENTO" });
    expect(await erroDe(vincularMandato(db, coord, d.id, { mandatoId: m.id, tipo: "ARTICULADOR" }))).toBe("CONFLITO");

    const det = await obterDemanda(db, coord, d.id);
    expect(det.mandatos.map((x) => x.tipo)).toEqual(["ARTICULADOR", "ACOMPANHAMENTO"]);
    expect(det.historico.filter((h) => h.tipo === "ARTICULACAO")).toHaveLength(2);
    expect(await db.demandaMandato.count({ where: { tipo: { in: ["AUTOR", "COAUTOR"] } } })).toBe(0);

    expect((await opcoesMandatosParceiros(db)).map((o) => o.id)).toEqual([m.id]);
    expect((await obterParlamentar(db, coord, parceiro.id)).vinculos).toHaveLength(2);
    expect(await erroDe(excluirMandato(db, coord, m.id))).toBe("VALIDACAO");

    await desvincularMandato(db, coord, v.id);
    expect(await db.demandaMandato.count()).toBe(1);
    expect(await db.demandaHistorico.count({ where: { demandaId: d.id, tipo: "ARTICULACAO" } })).toBe(3);
    expect(await db.auditLog.count({ where: { entidade: "demanda_mandato" } })).toBe(3);
  });

  it("assessor só vincula em demanda dele; consulta nunca", async () => {
    const coord = await criarUsuarioTeste("COORDENACAO");
    const assessor = await criarUsuarioTeste("ASSESSOR");
    const consulta = await criarUsuarioTeste("CONSULTA");
    const p = await criarParlamentar(db, coord, parl());
    const m = await criarMandato(db, coord, p.id, mand("2023-02-01", "2027-01-31"));
    const deOutro = await demandaDe(coord);
    const minha = await demandaDe(assessor);
    expect(await erroDe(vincularMandato(db, assessor, deOutro.id, { mandatoId: m.id, tipo: "PARCEIRO" }))).toBe("PROIBIDO");
    expect(await erroDe(vincularMandato(db, consulta, minha.id, { mandatoId: m.id, tipo: "PARCEIRO" }))).toBe("PROIBIDO");
    const v = await vincularMandato(db, assessor, minha.id, { mandatoId: m.id, tipo: "PARCEIRO" });
    expect(await erroDe(desvincularMandato(db, consulta, v.id))).toBe("PROIBIDO");
  });
});

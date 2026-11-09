import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  alternarEixo, atualizarOportunidade, avaliarOportunidade, criarEixo, criarOportunidade, definirPrioridadeManual, listarOportunidades,
  obterOportunidade, opcoesFormOportunidade,
} from "@/server/services/oportunidades";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };

let base: Awaited<ReturnType<typeof criarBase>>;
let eixo: { id: number };
let coord: Ator;
let assessor: Ator;
let assessor2: Ator;
let consulta: Ator;

const entrada = (extra: Record<string, unknown> = {}) => ({
  nome: "Restaurante popular na regional Leste",
  problema: "Insegurança alimentar em famílias de baixa renda.",
  descricaoProblema: "Muitas famílias da região não têm acesso diário a refeição de qualidade.",
  publico: "Famílias inscritas no CadÚnico",
  objetivo: "Garantir refeição a preço acessível.",
  solucao: "Projeto de lei que institui programa de restaurante popular.",
  eixoId: eixo.id,
  ...extra,
});

const erro = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as AppError | null;

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  eixo = await db.eixoLegislativo.create({ data: { nome: "Segurança alimentar" } });
  coord = await criarUsuarioTeste("COORDENACAO");
  assessor = await criarUsuarioTeste("ASSESSOR");
  assessor2 = await criarUsuarioTeste("ASSESSOR");
  consulta = await criarUsuarioTeste("CONSULTA");
});

describe("oportunidades legislativas", () => {
  it("cadastra com bairros e regionais, histórico e auditoria", async () => {
    const o = await criarOportunidade(db, assessor, entrada({ bairroIds: [base.bairro.id], regionalIds: `${base.regional.id},${base.outra.id}` }));
    const d = await obterOportunidade(db, consulta, o.id);
    expect(d.bairros.map((b) => b.bairro.nome)).toEqual(["Santa Tereza"]);
    expect(d.regionais).toHaveLength(2);
    expect(d.historico[0].tipo).toBe("CRIACAO");
    expect(d.prioridade).toBeNull();
    expect(await db.auditLog.count({ where: { entidade: "oportunidade", registroId: o.id, acao: "CRIAR" } })).toBe(1);
  });

  it("valida obrigatórios, eixo e permissão de criar", async () => {
    expect((await erro(criarOportunidade(db, assessor, entrada({ nome: "" }))))?.message).toMatch(/nome da proposta/);
    expect((await erro(criarOportunidade(db, assessor, entrada({ eixoId: 9999 }))))?.message).toMatch(/Eixo/);
    expect((await erro(criarOportunidade(db, assessor, entrada({ bairroIds: [9999] }))))?.message).toMatch(/Bairro/);
    expect((await erro(criarOportunidade(db, consulta, entrada())))?.code).toBe("PROIBIDO");
  });

  it("assessor edita só o que criou ou pelo qual é responsável", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    expect((await erro(atualizarOportunidade(db, assessor2, o.id, entrada({ nome: "Outro nome da proposta" }))))?.code).toBe("PROIBIDO");
    await atualizarOportunidade(db, coord, o.id, entrada({ responsavelId: assessor2.id }));
    await atualizarOportunidade(db, assessor2, o.id, entrada({ responsavelId: assessor2.id, objetivo: "Novo objetivo da proposta." }));
    const d = await obterOportunidade(db, assessor2, o.id);
    expect(d.objetivo).toBe("Novo objetivo da proposta.");
    expect(d.historico.filter((h) => h.tipo === "EDICAO")).toHaveLength(2);
  });

  it("avaliação calcula a nota e a prioridade automática", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    await avaliarOportunidade(db, assessor, o.id, { notaImpacto: 5, notaAlcance: 4, notaViabilidade: 4, notaExecucao: 3, notaInovacao: 4 });
    let d = await obterOportunidade(db, consulta, o.id);
    expect(d.notaFinal).toBe(83);
    expect(d.prioridade).toBe("MAXIMA");
    expect((await erro(avaliarOportunidade(db, assessor, o.id, { notaImpacto: 6, notaAlcance: 4, notaViabilidade: 4, notaExecucao: 3, notaInovacao: 4 })))?.message).toMatch(/0 a 5/);
    expect((await erro(avaliarOportunidade(db, consulta, o.id, { notaImpacto: 1, notaAlcance: 1, notaViabilidade: 1, notaExecucao: 1, notaInovacao: 1 })))?.code).toBe("PROIBIDO");
    await avaliarOportunidade(db, assessor, o.id, { notaImpacto: 2, notaAlcance: 2, notaViabilidade: 2, notaExecucao: 2, notaInovacao: 2 });
    d = await obterOportunidade(db, consulta, o.id);
    expect(d.prioridade).toBe("INTERMEDIARIA");
    expect(d.historico[0].descricao).toMatch(/nota 40.*antes era 83/);
  });

  it("prioridade manual exige justificativa e coordenação, e fica no histórico", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    await avaliarOportunidade(db, assessor, o.id, { notaImpacto: 1, notaAlcance: 1, notaViabilidade: 1, notaExecucao: 1, notaInovacao: 1 });
    expect((await erro(definirPrioridadeManual(db, assessor, o.id, { prioridade: "MAXIMA", justificativa: "Pedido do vereador." })))?.code).toBe("PROIBIDO");
    expect((await erro(definirPrioridadeManual(db, coord, o.id, { prioridade: "MAXIMA", justificativa: "" })))?.message).toMatch(/justificativa/);
    await definirPrioridadeManual(db, coord, o.id, { prioridade: "MAXIMA", justificativa: "Pedido direto do vereador após audiência." });
    let d = await obterOportunidade(db, consulta, o.id);
    expect(d.prioridade).toBe("MAXIMA");
    expect(d.prioridadeCalculada).toBe("BAIXA");
    expect(d.historico[0].descricao).toMatch(/automática → Prioridade máxima.*audiência/);
    await definirPrioridadeManual(db, coord, o.id, { prioridade: "", justificativa: "Voltar a seguir a nota calculada." });
    d = await obterOportunidade(db, consulta, o.id);
    expect(d.prioridade).toBe("BAIXA");
    expect(d.justificativaPrioridade).toBeNull();
  });

  it("filtra por eixo, regional, responsável e prioridade efetiva", async () => {
    const outro = await db.eixoLegislativo.create({ data: { nome: "Cultura" } });
    const a = await criarOportunidade(db, assessor, entrada({ regionalIds: [base.regional.id], responsavelId: assessor.id }));
    const b = await criarOportunidade(db, assessor, entrada({ nome: "Ponto de cultura", eixoId: outro.id, bairroIds: [base.bairroOeste.id] }));
    await avaliarOportunidade(db, assessor, a.id, { notaImpacto: 5, notaAlcance: 5, notaViabilidade: 5, notaExecucao: 5, notaInovacao: 5 });
    await avaliarOportunidade(db, assessor, b.id, { notaImpacto: 5, notaAlcance: 5, notaViabilidade: 5, notaExecucao: 5, notaInovacao: 5 });
    await definirPrioridadeManual(db, coord, b.id, { prioridade: "BAIXA", justificativa: "Já existe lei parecida em vigor." });
    const ids = async (f: Record<string, string>) => (await listarOportunidades(db, consulta, f)).itens.map((o) => o.id);
    expect(await ids({ eixo: String(outro.id) })).toEqual([b.id]);
    expect(await ids({ regional: String(base.outra.id) })).toEqual([b.id]);
    expect(await ids({ responsavel: assessor.id })).toEqual([a.id]);
    expect(await ids({ prioridade: "MAXIMA" })).toEqual([a.id]);
    expect(await ids({ prioridade: "BAIXA" })).toEqual([b.id]);
    expect(await ids({ q: "cultura" })).toEqual([b.id]);
  });

  it("eixos: só cadastros base cria, sem duplicar, e inativo some do formulário", async () => {
    expect((await erro(criarEixo(db, assessor, { nome: "Turismo" })))?.code).toBe("PROIBIDO");
    const t = await criarEixo(db, coord, { nome: "Turismo" });
    expect((await erro(criarEixo(db, coord, { nome: "turismo" })))?.code).toBe("CONFLITO");
    await alternarEixo(db, coord, t.id);
    expect((await opcoesFormOportunidade(db)).eixos.map((e) => e.nome)).toEqual(["Segurança alimentar"]);
    expect((await erro(criarOportunidade(db, assessor, entrada({ eixoId: t.id }))))?.message).toMatch(/Eixo/);
  });
});

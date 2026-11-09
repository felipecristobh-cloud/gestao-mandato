import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste } from "../setup/db";
import {
  atualizarProposicao, conferirImportacao, criarProposicao, importarProposicoes, listarProposicoes, obterProposicao, resumoConferencia,
} from "@/server/services/proposicoes";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };
let coord: Ator;
let assessor: Ator;
let assessor2: Ator;
let consulta: Ator;
let eixo: { id: number };

const erro = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as AppError | null;
const prop = (extra: Record<string, unknown> = {}) => ({
  tipo: "PROJETO_LEI", numero: "100", ano: "2018", ementa: "Ementa fictícia de teste", participacao: "AUTORIA", fonte: "Teste", ...extra,
});

beforeEach(async () => {
  await limparBanco();
  coord = await criarUsuarioTeste("COORDENACAO");
  assessor = await criarUsuarioTeste("ASSESSOR");
  assessor2 = await criarUsuarioTeste("ASSESSOR");
  consulta = await criarUsuarioTeste("CONSULTA");
  eixo = await db.eixoLegislativo.create({ data: { nome: "Educação" } });
});

describe("histórico legislativo", () => {
  it("cadastra com fonte, bloqueia duplicada e respeita permissões", async () => {
    const p = await criarProposicao(db, assessor, prop({ eixoId: String(eixo.id) }));
    expect(p.verificacao).toBe("AGUARDANDO");
    expect((await erro(criarProposicao(db, coord, prop())))?.message).toMatch(/Já existe PL 100\/2018/);
    expect((await erro(criarProposicao(db, consulta, prop({ numero: "101" }))))?.code).toBe("PROIBIDO");
    expect((await erro(criarProposicao(db, assessor, prop({ numero: "102", ano: "2012" }))))?.code).toBe("VALIDACAO");
    expect((await erro(atualizarProposicao(db, assessor2, p.id, prop({ situacao: "Arquivada" }))))?.code).toBe("PROIBIDO");
    await atualizarProposicao(db, assessor, p.id, prop({ situacao: "Arquivada", verificacao: "CORRIGIDO" }));
    const d = await obterProposicao(db, consulta, p.id);
    expect(d.situacao).toBe("Arquivada");
    expect(d.historico.map((h) => h.tipo).sort()).toEqual(["CRIACAO", "EDICAO", "VERIFICACAO"]);
    expect(await db.auditLog.count({ where: { entidade: "proposicao", registroId: p.id } })).toBe(2);
    await expect(db.$executeRawUnsafe(`UPDATE proposicao SET ano = 2030 WHERE id = '${p.id}'`)).rejects.toThrow();
  });

  it("filtra por mandato, ano, tipo, autoria, eixo, situação e verificação", async () => {
    await criarProposicao(db, coord, prop({ numero: "1", ano: "2013", eixoId: String(eixo.id) }));
    await criarProposicao(db, coord, prop({ numero: "2", ano: "2022", tipo: "REQ", participacao: "COAUTORIA", situacao: "Aprovado" }));
    await criarProposicao(db, coord, prop({ numero: "3", ano: "2026", participacao: "DISCUSSAO", verificacao: "CONFIRMADO", linkOficial: "https://www.cmbh.mg.gov.br/3" }));
    const n = async (f: object) => (await listarProposicoes(db, consulta, f)).total;
    expect(await n({ mandato: "1" })).toBe(1);
    expect(await n({ mandato: "3" })).toBe(1);
    expect(await n({ ano: "2026" })).toBe(1);
    expect(await n({ tipo: "REQUERIMENTO" })).toBe(1);
    expect(await n({ participacao: "COAUTORIA" })).toBe(1);
    expect(await n({ eixo: String(eixo.id) })).toBe(1);
    expect(await n({ eixo: "nenhum" })).toBe(2);
    expect(await n({ situacao: "aprov" })).toBe(1);
    expect(await n({ verificacao: "CONFIRMADO" })).toBe(1);
    expect(await n({ q: "3" })).toBe(1);
    const l = await listarProposicoes(db, consulta);
    expect(l.porMandato.map((m) => m.total)).toEqual([1, 0, 1, 1]);
  });

  it("importação: confere sem gravar, aponta erros, duplicadas e incompletas; grava só as prontas", async () => {
    await criarProposicao(db, coord, prop({ numero: "7", ano: "2015" }));
    const linhas = [
      { tipo: "PL", numero: "7", ano: "2015", ementa: "Já existe", participacao: "Autoria" },
      { tipo: "PL", numero: "8", ano: "2015", ementa: "Nova completa", participacao: "Autoria", dataApresentacao: "01/02/2015", situacao: "Arquivado", linkOficial: "https://www.cmbh.mg.gov.br/8", eixo: "educacao" },
      { tipo: "PL", numero: "8", ano: "2015", ementa: "Repetida", participacao: "Autoria" },
      { tipo: "Moção", numero: "x", ano: "2009", ementa: "", participacao: "?" },
      { tipo: "REQ", numero: "9", ano: "2016", ementa: "Sem data", participacao: "coautoria", eixo: "Inexistente" },
      { tipo: "REQ", numero: "10", ano: "2016", ementa: "Incompleta", participacao: "coautoria", fonte: "Diário Oficial" },
    ];
    const c = await conferirImportacao(db, assessor, linhas, "Planilha do gabinete");
    expect(c.map((l) => [l.linha, l.ok, l.duplicada])).toEqual([
      [2, false, "banco"], [3, true, null], [4, false, "planilha"], [5, false, null], [6, false, null], [7, true, null],
    ]);
    expect(c[3].erros.length).toBeGreaterThanOrEqual(4);
    expect(c[4].erros[0]).toMatch(/Eixo desconhecido/);
    expect(c[5].avisos).toEqual(["Sem data de apresentação.", "Sem situação atual.", "Sem link oficial."]);
    expect(resumoConferencia(c)).toEqual({ total: 6, prontas: 2, comErro: 2, duplicadas: 2, incompletas: 1 });
    expect(await db.proposicao.count()).toBe(1);

    expect((await erro(importarProposicoes(db, consulta, linhas)))?.code).toBe("PROIBIDO");
    const r = await importarProposicoes(db, assessor, linhas, "Planilha do gabinete");
    expect(r).toEqual({ importadas: 2, ignoradas: 4 });
    const p8 = await db.proposicao.findFirstOrThrow({ where: { numero: 8 }, include: { historico: true } });
    expect(p8.fonte).toBe("Planilha do gabinete");
    expect(p8.eixoId).toBe(eixo.id);
    expect(p8.verificacao).toBe("AGUARDANDO");
    expect(p8.historico[0].tipo).toBe("IMPORTACAO");
    expect((await db.proposicao.findFirstOrThrow({ where: { numero: 10 } })).fonte).toBe("Diário Oficial");
    expect((await erro(importarProposicoes(db, assessor, linhas)))?.message).toMatch(/Nenhuma linha pronta/);
  });
});

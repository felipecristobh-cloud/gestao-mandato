import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  atualizarEntidade, buscarEntidadesSemelhantes, criarEntidade, listarEntidades, obterEntidade, vincularMandatoEntidade,
} from "@/server/services/entidades";
import {
  alterarStatusCompromisso, atualizarCompromisso, buscarChoques, criarCompromisso, obterCompromisso, registrarResultado, vincularCompromisso,
  desvincularCompromisso, compromissosVinculados,
} from "@/server/services/agenda";
import { criarDemanda, obterDemanda } from "@/server/services/demandas";
import { criarEmenda, obterEmenda } from "@/server/services/emendas";
import { criarMandato, criarParlamentar } from "@/server/services/parlamentares";
import { completarCnpj } from "@/lib/emendas";
import { deDataHoraLocal } from "@/lib/agenda";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };

let base: Awaited<ReturnType<typeof criarBase>>;
let coord: Ator;
let assessor: Ator;
let assessor2: Ator;
let consulta: Ator;

beforeEach(async () => {
  await limparBanco();
  base = await criarBase();
  coord = await criarUsuarioTeste("COORDENACAO");
  assessor = await criarUsuarioTeste("ASSESSOR");
  assessor2 = await criarUsuarioTeste("ASSESSOR");
  consulta = await criarUsuarioTeste("CONSULTA");
});

async function erroDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as AppError).code;
  }
  return "SEM_ERRO";
}

const CNPJ = completarCnpj("445556660001");
const entidade = (extra: Record<string, unknown> = {}) => ({
  nome: "Associação Comunitária Fictícia do Bairro", tipo: "ASSOCIACAO", cnpj: CNPJ, temaId: String(base.tema.id), bairroId: String(base.bairro.id),
  telefone: "(31) 97777-1234", email: "contato@associacao.exemplo", responsavel: "Pessoa Fictícia", ...extra,
});

describe("entidades", () => {
  it("cria com auditoria, bloqueia CNPJ repetido e Consulta", async () => {
    const e = await criarEntidade(db, assessor, entidade());
    expect(e.cnpj).toBe(CNPJ);
    expect(await db.auditLog.count({ where: { entidade: "entidade", registroId: e.id, acao: "CRIAR" } })).toBe(1);
    expect(await erroDe(criarEntidade(db, coord, entidade({ nome: "Outra entidade" })))).toBe("CONFLITO");
    expect(await erroDe(criarEntidade(db, coord, entidade({ cnpj: "44.555.666/0001-00" })))).toBe("VALIDACAO");
    expect(await erroDe(criarEntidade(db, consulta, entidade({ cnpj: "" })))).not.toBe("SEM_ERRO");
  });

  it("acha semelhantes por nome ou CNPJ", async () => {
    const e = await criarEntidade(db, coord, entidade());
    const porNome = await buscarEntidadesSemelhantes(db, coord, { nome: "Associacao Comunitaria Ficticia do Bairro" });
    expect(porNome.map((x) => x.id)).toContain(e.id);
    const porCnpj = await buscarEntidadesSemelhantes(db, coord, { nome: "Nome totalmente diferente", cnpj: CNPJ });
    expect(porCnpj.map((x) => x.id)).toEqual([e.id]);
    expect(await buscarEntidadesSemelhantes(db, coord, { nome: "Associação Comunitária Fictícia do Bairro" }, e.id)).toEqual([]);
  });

  it("assessor só edita o que cadastrou; Consulta vê contato mascarado", async () => {
    const e = await criarEntidade(db, assessor, entidade());
    expect(await erroDe(atualizarEntidade(db, assessor2, e.id, entidade({ nome: "Mudou" })))).not.toBe("SEM_ERRO");
    await atualizarEntidade(db, assessor, e.id, entidade({ nome: "Associação Fictícia Renomeada" }));
    await atualizarEntidade(db, coord, e.id, entidade({ nome: "Associação Fictícia Renomeada", ativo: "" }));
    const c = await obterEntidade(db, consulta, e.id);
    expect(c.telefone).not.toBe("(31) 97777-1234");
    expect(c.email).not.toBe("contato@associacao.exemplo");
    const lista = await listarEntidades(db, coord, { situacao: "inativas" });
    expect(lista.itens.map((x) => x.id)).toContain(e.id);
    expect((await listarEntidades(db, coord, { q: "renomeada", situacao: "todas" })).itens.length).toBe(1);
  });

  it("vincula mandato sem autoria e liga a demandas e emendas", async () => {
    const e = await criarEntidade(db, coord, entidade());
    const p = await criarParlamentar(db, coord, { nome: "Deputada Fictícia", cargo: "DEPUTADO_ESTADUAL" });
    const m = await criarMandato(db, coord, p.id, { cargo: "DEPUTADO_ESTADUAL", dataInicio: "2023-02-01", dataFim: "2027-01-31" });
    await vincularMandatoEntidade(db, coord, e.id, { mandatoId: m.id, tipo: "PARCEIRO" });
    expect(await erroDe(vincularMandatoEntidade(db, coord, e.id, { mandatoId: m.id, tipo: "PARCEIRO" }))).toBe("CONFLITO");
    expect(await erroDe(vincularMandatoEntidade(db, coord, e.id, { mandatoId: m.id, tipo: "AUTOR" }))).toBe("VALIDACAO");

    const d = await criarDemanda(db, coord, {
      solicitanteNome: "Joana Fictícia", telefone: "(31) 98888-1234", temaId: String(base.tema.id),
      descricao: "Pedido fictício de reforma da sede da associação", entidadeId: e.id,
    });
    expect((await obterDemanda(db, coord, d.id)).entidade?.id).toBe(e.id);
    expect(await erroDe(criarDemanda(db, coord, {
      solicitanteNome: "Joana Fictícia", temaId: String(base.tema.id), descricao: "Pedido fictício com entidade inexistente",
      entidadeId: "00000000-0000-4000-8000-000000000000",
    }))).toBe("VALIDACAO");

    const em = await criarEmenda(db, coord, { esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", objeto: "Equipamentos fictícios para a sede", valorIndicado: "50.000,00", entidadeId: e.id });
    const o = await obterEmenda(db, coord, em.id);
    expect(o.beneficiario).toBe(e.nome);
    expect(o.cnpj).toBe(CNPJ);
    expect(await erroDe(criarEmenda(db, coord, {
      esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", objeto: "Outra emenda fictícia", valorIndicado: "1.000,00", entidadeId: e.id, cnpj: completarCnpj("112223330001"),
    }))).toBe("VALIDACAO");

    const ob = await obterEntidade(db, coord, e.id);
    expect(ob.demandas.map((x) => x.id)).toEqual([d.id]);
    expect(ob.emendas.map((x) => x.id)).toEqual([em.id]);
    expect(ob.mandatos.length).toBe(1);
  });
});

const h = (v: string) => deDataHoraLocal(v)!;
const comp = (extra: Record<string, unknown> = {}) => ({
  titulo: "Reunião fictícia com moradores", tipo: "REUNIAO", inicio: "2026-11-10T09:00", fim: "2026-11-10T10:00", ...extra,
});

describe("agenda", () => {
  it("agenda do vereador: assessor solicita, só coordenação confirma", async () => {
    expect(await erroDe(criarCompromisso(db, assessor, comp({ agendaVereador: "on", confirmado: "on" })))).not.toBe("SEM_ERRO");
    const c = await criarCompromisso(db, assessor, comp({ agendaVereador: "on" }));
    expect(c.status).toBe("SOLICITADO");
    expect(await erroDe(alterarStatusCompromisso(db, assessor, c.id, { status: "CONFIRMADO" }))).not.toBe("SEM_ERRO");
    expect((await obterCompromisso(db, assessor, c.id)).podeConfirmar).toBe(false);
    await alterarStatusCompromisso(db, coord, c.id, { status: "CONFIRMADO" });
    expect(await erroDe(atualizarCompromisso(db, assessor, c.id, comp({ agendaVereador: "on", inicio: "2026-11-10T11:00", fim: "2026-11-10T12:00" })))).not.toBe("SEM_ERRO");
    const fora = await criarCompromisso(db, assessor, comp({ confirmado: "on" }));
    expect(fora.status).toBe("CONFIRMADO");
    expect(await erroDe(criarCompromisso(db, consulta, comp()))).not.toBe("SEM_ERRO");
  });

  it("adiar/cancelar pedem motivo; resultado só depois de realizado", async () => {
    const c = await criarCompromisso(db, assessor, comp({ inicio: "2026-01-10T09:00", fim: "2026-01-10T10:00" }));
    expect(await erroDe(alterarStatusCompromisso(db, assessor, c.id, { status: "CANCELADO" }))).toBe("VALIDACAO");
    expect(await erroDe(registrarResultado(db, assessor, c.id, { resultado: "Ficou combinado algo." }))).toBe("VALIDACAO");
    expect(await erroDe(alterarStatusCompromisso(db, assessor, c.id, { status: "REALIZADO" }, {}, h("2026-01-10T08:00")))).toBe("VALIDACAO");
    await alterarStatusCompromisso(db, assessor, c.id, { status: "REALIZADO" }, {}, h("2026-01-10T11:00"));
    await registrarResultado(db, assessor, c.id, { resultado: "Ficou combinado vistoria.", encaminhamentos: "Enviar ofício." });
    const o = await obterCompromisso(db, assessor, c.id);
    expect(o.resultado).toBe("Ficou combinado vistoria.");
    expect(o.historico.map((x) => x.tipo).sort()).toEqual(["CRIACAO", "RESULTADO", "STATUS"]);
    const c2 = await criarCompromisso(db, assessor, comp());
    await alterarStatusCompromisso(db, assessor, c2.id, { status: "ADIADO", motivo: "Chuva forte." });
    expect(await erroDe(alterarStatusCompromisso(db, assessor2, c2.id, { status: "CANCELADO", motivo: "x x" }))).not.toBe("SEM_ERRO");
  });

  it("detecta choque com as mesmas pessoas, ignora cancelados e encostados", async () => {
    const a = await criarCompromisso(db, coord, comp({ responsavelId: assessor.id }));
    await criarCompromisso(db, coord, comp({ titulo: "Encostado fictício", inicio: "2026-11-10T10:00", fim: "2026-11-10T11:00", responsavelId: assessor.id }));
    const cancelado = await criarCompromisso(db, coord, comp({ titulo: "Cancelado fictício", participantes: [assessor.id] }));
    await alterarStatusCompromisso(db, coord, cancelado.id, { status: "CANCELADO", motivo: "Desmarcado." });
    const choques = await buscarChoques(db, coord, { inicio: h("2026-11-10T09:30"), fim: h("2026-11-10T10:00"), responsavelId: null, participantes: [assessor.id], agendaVereador: false });
    expect(choques.map((x) => x.id)).toEqual([a.id]);
    expect(choques[0].pessoas).toEqual([(await db.usuario.findUniqueOrThrow({ where: { id: assessor.id } })).nome]);
    expect(await buscarChoques(db, coord, { inicio: h("2026-11-10T09:30"), fim: h("2026-11-10T10:00"), responsavelId: assessor2.id, participantes: [], agendaVereador: false })).toEqual([]);
  });

  it("vínculos com exatamente um alvo, sem duplicar", async () => {
    const e = await criarEntidade(db, coord, entidade());
    const c = await criarCompromisso(db, coord, comp({ tipo: "REUNIAO_ENTIDADE", vinculo: `entidade:${e.id}` }));
    expect(await erroDe(vincularCompromisso(db, coord, c.id, `entidade:${e.id}`))).toBe("CONFLITO");
    expect(await erroDe(vincularCompromisso(db, coord, c.id, "entidade:00000000-0000-4000-8000-000000000000"))).toBe("VALIDACAO");
    const lista = await compromissosVinculados(db, coord, { tipo: "entidade", id: e.id });
    expect(lista.map((x) => x.id)).toEqual([c.id]);
    await expect(db.$executeRaw`INSERT INTO compromisso_vinculo (id, compromisso_id) VALUES (gen_random_uuid(), ${c.id}::uuid)`).rejects.toThrow();
    const v = await db.compromissoVinculo.findFirstOrThrow({ where: { compromissoId: c.id } });
    await desvincularCompromisso(db, coord, v.id);
    expect(await compromissosVinculados(db, coord, { tipo: "entidade", id: e.id })).toEqual([]);
  });
});

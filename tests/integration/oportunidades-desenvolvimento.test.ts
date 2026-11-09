import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db, limparBanco, criarUsuarioTeste, criarBase } from "../setup/db";
import {
  alterarEtapa, criarOportunidade, desvincularOportunidade, listarOportunidades, obterOportunidade, oportunidadesLigadas, preencherDeOrigem, salvarTexto,
  versoesTexto, vincularOportunidade,
} from "@/server/services/oportunidades";
import { criarDemanda } from "@/server/services/demandas";
import { criarEmenda } from "@/server/services/emendas";
import { criarCompromisso } from "@/server/services/agenda";
import { documentosDe, enviarDocumento } from "@/server/services/documentos";
import { storageLocal } from "@/server/storage";
import type { AppError } from "@/server/errors";

type Ator = { id: string; perfil: "ADMIN" | "COORDENACAO" | "ASSESSOR" | "CONSULTA" };

let base: Awaited<ReturnType<typeof criarBase>>;
let eixo: { id: number };
let coord: Ator;
let assessor: Ator;
let assessor2: Ator;
let consulta: Ator;

const entrada = (extra: Record<string, unknown> = {}) => ({
  nome: "Programa de hortas comunitárias",
  problema: "Terrenos vazios e insegurança alimentar.",
  descricaoProblema: "Vários lotes públicos sem uso na regional.",
  publico: "Moradores da regional",
  objetivo: "Produzir alimentos em áreas ociosas.",
  solucao: "Projeto de lei que cria o programa municipal de hortas.",
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

describe("oportunidades — desenvolvimento", () => {
  it("etapas: assessor move até a validação do vereador; daí em diante só a coordenação", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    expect(o.etapa).toBe("IDEIA");
    await alterarEtapa(db, assessor, o.id, { etapa: "PESQUISA_JURIDICA", observacao: "Ver competência municipal." });
    expect((await erro(alterarEtapa(db, assessor, o.id, { etapa: "PESQUISA_JURIDICA" })))?.code).toBe("CONFLITO");
    expect((await erro(alterarEtapa(db, assessor, o.id, { etapa: "PROTOCOLADA" })))?.code).toBe("PROIBIDO");
    expect((await erro(alterarEtapa(db, assessor, o.id, { etapa: "ARQUIVADA" })))?.code).toBe("PROIBIDO");
    expect((await erro(alterarEtapa(db, assessor2, o.id, { etapa: "REVISAO" })))?.code).toBe("PROIBIDO");
    expect((await erro(alterarEtapa(db, consulta, o.id, { etapa: "REVISAO" })))?.code).toBe("PROIBIDO");
    expect((await erro(alterarEtapa(db, coord, o.id, { etapa: "XYZ" })))?.code).toBe("VALIDACAO");
    await alterarEtapa(db, coord, o.id, { etapa: "APROVADA_INTERNAMENTE" });
    expect((await erro(alterarEtapa(db, assessor, o.id, { etapa: "REVISAO" })))?.code).toBe("PROIBIDO");
    const d = await obterOportunidade(db, consulta, o.id);
    expect(d.etapa).toBe("APROVADA_INTERNAMENTE");
    const etapas = d.historico.filter((h) => h.tipo === "ETAPA").map((h) => h.descricao);
    expect(etapas[1]).toMatch(/Ideia cadastrada → Em pesquisa jurídica\. Ver competência municipal\./);
    expect(await db.auditLog.count({ where: { entidade: "oportunidade", registroId: o.id, acao: "EDITAR" } })).toBe(2);
    expect((await listarOportunidades(db, consulta, { etapa: "APROVADA_INTERNAMENTE" })).total).toBe(1);
    expect((await listarOportunidades(db, consulta, { etapa: "IDEIA" })).total).toBe(0);
  });

  it("textos guardam versões com autor; versão final só a coordenação", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    await salvarTexto(db, assessor, o.id, { tipo: "TEXTO_INICIAL", conteudo: "Art. 1º Fica instituído o programa." });
    expect((await erro(salvarTexto(db, assessor, o.id, { tipo: "TEXTO_INICIAL", conteudo: "Art. 1º Fica instituído o programa." })))?.code).toBe("CONFLITO");
    await salvarTexto(db, coord, o.id, { tipo: "TEXTO_INICIAL", conteudo: "Art. 1º Fica instituído o Programa Municipal de Hortas." });
    expect((await erro(salvarTexto(db, assessor, o.id, { tipo: "VERSAO_FINAL", conteudo: "Texto final" })))?.code).toBe("PROIBIDO");
    expect((await erro(salvarTexto(db, assessor2, o.id, { tipo: "JUSTIFICATIVA", conteudo: "x" })))?.code).toBe("PROIBIDO");
    expect((await erro(salvarTexto(db, assessor, o.id, { tipo: "JUSTIFICATIVA", conteudo: "   " })))?.code).toBe("VALIDACAO");
    await salvarTexto(db, coord, o.id, { tipo: "VERSAO_FINAL", conteudo: "Texto final aprovado." });
    const v = await versoesTexto(db, consulta, o.id, "TEXTO_INICIAL");
    expect(v.versoes.map((x) => x.versao)).toEqual([2, 1]);
    expect(v.versoes[1].conteudo).toBe("Art. 1º Fica instituído o programa.");
    expect(v.versoes[1].autorId).toBe(assessor.id);
    const d = await obterOportunidade(db, consulta, o.id);
    const inicial = d.textosAtuais.find((t) => t.tipo === "TEXTO_INICIAL")!;
    expect(inicial.atual?.versao).toBe(2);
    expect(inicial.versoes).toBe(2);
    expect(d.historico.filter((h) => h.tipo === "TEXTO")).toHaveLength(3);
  });

  it("transforma demanda em proposta sem alterar a demanda e sem copiar dados do cidadão", async () => {
    const dem = await criarDemanda(db, coord, {
      solicitanteNome: "Maria Fictícia", solicitanteTelefone: "31999990000", endereco: "Rua Fictícia, 10", bairroId: String(base.bairro.id),
      temaId: String(base.tema.id), tipo: "SOLICITACAO", prioridade: "MEDIA", descricao: "Lote abandonado acumulando lixo na rua.",
    } as never);
    const antes = await db.demanda.findUniqueOrThrow({ where: { id: dem.id } });
    const pre = await preencherDeOrigem(db, assessor, { demandaId: dem.id });
    expect(pre?.valores.descricaoProblema).toContain(dem.protocolo);
    expect(pre?.valores.bairroIds).toBe(String(base.bairro.id));
    expect(pre?.valores.regionalIds).toBe(String(base.regional.id));
    expect(JSON.stringify(pre)).not.toMatch(/Maria|31999990000/);
    expect((await erro(preencherDeOrigem(db, consulta, { demandaId: dem.id })))?.code).toBe("PROIBIDO");

    const o = await criarOportunidade(db, assessor, entrada(), {}, { demandaId: dem.id });
    const depois = await db.demanda.findUniqueOrThrow({ where: { id: dem.id } });
    expect(depois).toEqual(antes);
    const d = await obterOportunidade(db, consulta, o.id);
    expect(d.demandaOrigem?.protocolo).toBe(dem.protocolo);
    expect(d.vinculos).toHaveLength(1);
    expect(d.historico[0].descricao).toMatch(new RegExp(`a partir da demanda ${dem.protocolo}`));
    const ligadas = await oportunidadesLigadas(db, consulta, { demandaId: dem.id });
    expect(ligadas).toEqual([expect.objectContaining({ id: o.id, surgiuDaqui: true })]);
    expect((await listarOportunidades(db, consulta, { origem: "demanda" })).total).toBe(1);
    expect((await erro(desvincularOportunidade(db, assessor, o.id, d.vinculos[0].id)))?.code).toBe("CONFLITO");
    expect((await erro(criarOportunidade(db, assessor, entrada(), {}, { demandaId: "00000000-0000-0000-0000-000000000000" })))?.code).toBe("VALIDACAO");
  });

  it("vincula demanda por protocolo, emenda e compromisso; remove vínculo", async () => {
    const o = await criarOportunidade(db, assessor, entrada());
    const dem = await criarDemanda(db, coord, {
      solicitanteNome: "Pessoa Fictícia", bairroId: String(base.bairro.id), temaId: String(base.tema.id), tipo: "SOLICITACAO", prioridade: "MEDIA",
      descricao: "Descrição fictícia de demanda.",
    } as never);
    const em = await criarEmenda(db, coord, { esfera: "MUNICIPAL", ano: "2026", tipo: "INDIVIDUAL", objeto: "Horta fictícia", valorIndicado: "1.000,00" } as never);
    const c = await criarCompromisso(db, coord, { titulo: "Audiência pública fictícia", tipo: "AUDIENCIA", inicio: "2026-11-10T09:00", fim: "2026-11-10T11:00" } as never);
    await vincularOportunidade(db, assessor, o.id, { tipo: "demanda", ref: dem.protocolo.toLowerCase() });
    await vincularOportunidade(db, assessor, o.id, { tipo: "emenda", ref: em.id });
    await vincularOportunidade(db, assessor, o.id, { tipo: "compromisso", ref: c.id });
    expect((await erro(vincularOportunidade(db, assessor, o.id, { tipo: "emenda", ref: em.id })))?.code).toBe("CONFLITO");
    expect((await erro(vincularOportunidade(db, assessor, o.id, { tipo: "demanda", ref: "DEM-1900-99999" })))?.code).toBe("VALIDACAO");
    expect((await erro(vincularOportunidade(db, assessor2, o.id, { tipo: "compromisso", ref: c.id })))?.code).toBe("PROIBIDO");
    expect((await oportunidadesLigadas(db, consulta, { emendaId: em.id })).map((x) => x.id)).toEqual([o.id]);
    expect((await oportunidadesLigadas(db, consulta, { compromissoId: c.id })).map((x) => x.id)).toEqual([o.id]);
    const d = await obterOportunidade(db, consulta, o.id);
    expect(d.vinculos).toHaveLength(3);
    await desvincularOportunidade(db, assessor, o.id, d.vinculos.find((v) => v.emendaId)!.id);
    expect(await oportunidadesLigadas(db, consulta, { emendaId: em.id })).toEqual([]);
    expect((await obterOportunidade(db, consulta, o.id)).historico.filter((h) => h.tipo === "VINCULO")).toHaveLength(4);

    const pre = await preencherDeOrigem(db, assessor, { compromissoId: c.id });
    expect(pre?.valores.nome).toBe("Audiência pública fictícia");
    const nova = await criarOportunidade(db, assessor, entrada(), {}, { compromissoId: c.id });
    expect((await oportunidadesLigadas(db, consulta, { compromissoId: c.id })).map((x) => x.id)).toContain(nova.id);
  });

  it("anexa documentos à proposta reaproveitando o módulo de documentos", async () => {
    const storage = storageLocal(await mkdtemp(path.join(tmpdir(), "gm-op-")));
    const o = await criarOportunidade(db, assessor, entrada());
    const pdf = new File(["%PDF-1.4\n%fictício\n"], "Minuta v1.pdf");
    await enviarDocumento(db, assessor, { arquivo: pdf, categoria: "MINUTA", vinculo: { tipo: "oportunidade", id: o.id } }, {}, storage);
    expect((await erro(enviarDocumento(db, assessor2, { arquivo: pdf, vinculo: { tipo: "oportunidade", id: o.id } }, {}, storage)))?.code).toBe("PROIBIDO");
    const docs = await documentosDe(db, consulta, { tipo: "oportunidade", id: o.id });
    expect(docs.map((d) => [d.nome, d.categoria])).toEqual([["Minuta v1.pdf", "MINUTA"]]);
  });
});

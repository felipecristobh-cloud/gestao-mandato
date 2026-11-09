import type { EtapaOportunidade, PrioridadeOportunidade, TipoTextoOportunidade } from "@prisma/client";

export const CRITERIOS = [
  { campo: "notaImpacto", rotulo: "Impacto direto na vida da população", peso: 30 },
  { campo: "notaAlcance", rotulo: "Alcance social", peso: 20 },
  { campo: "notaViabilidade", rotulo: "Viabilidade jurídica", peso: 20 },
  { campo: "notaExecucao", rotulo: "Possibilidade de execução", peso: 15 },
  { campo: "notaInovacao", rotulo: "Inovação legislativa", peso: 15 },
] as const;

export type CampoNota = (typeof CRITERIOS)[number]["campo"];
export type Notas = Partial<Record<CampoNota, number | null>>;

/** Nota final de 0 a 100 (cada critério de 0 a 5 vezes o peso). Nula se faltar algum critério. */
export function calcularNotaFinal(n: Notas): number | null {
  let soma = 0;
  for (const c of CRITERIOS) {
    const v = n[c.campo];
    if (v === null || v === undefined) return null;
    soma += (v / 5) * c.peso;
  }
  return Math.round(soma);
}

export function classificarNota(nota: number): PrioridadeOportunidade {
  if (nota >= 80) return "MAXIMA";
  if (nota >= 60) return "ALTA";
  if (nota >= 40) return "INTERMEDIARIA";
  return "BAIXA";
}

/** A prioridade manual (com justificativa) prevalece sobre a calculada. */
export function prioridadeEfetiva(o: { notaFinal: number | null; prioridadeManual: PrioridadeOportunidade | null }) {
  if (o.prioridadeManual) return o.prioridadeManual;
  return o.notaFinal === null ? null : classificarNota(o.notaFinal);
}

export const PRIORIDADES_OPORTUNIDADE: PrioridadeOportunidade[] = ["MAXIMA", "ALTA", "INTERMEDIARIA", "BAIXA"];

export const ROTULO_PRIORIDADE_OPORTUNIDADE: Record<PrioridadeOportunidade, string> = {
  MAXIMA: "Prioridade máxima",
  ALTA: "Alta prioridade",
  INTERMEDIARIA: "Prioridade intermediária",
  BAIXA: "Baixa prioridade",
};

export const COR_PRIORIDADE_OPORTUNIDADE: Record<PrioridadeOportunidade, "vermelho" | "amarelo" | "azul" | "cinza"> = {
  MAXIMA: "vermelho",
  ALTA: "amarelo",
  INTERMEDIARIA: "azul",
  BAIXA: "cinza",
};

export const AVISO_JURIDICO = "Nota alta não significa que o projeto seja constitucional: a análise jurídica é feita e validada separadamente.";

// ---------- desenvolvimento ----------

export const ETAPAS_OPORTUNIDADE: EtapaOportunidade[] = [
  "IDEIA", "ANALISE_POLITICA", "PESQUISA_JURIDICA", "ELABORACAO", "REVISAO", "AGUARDANDO_VEREADOR", "APROVADA_INTERNAMENTE",
  "PRONTA_PROTOCOLO", "PROTOCOLADA", "EM_TRAMITACAO", "APROVADA", "LEI", "ARQUIVADA", "SUSPENSA",
];

export const ROTULO_ETAPA: Record<EtapaOportunidade, string> = {
  IDEIA: "Ideia cadastrada",
  ANALISE_POLITICA: "Em análise política",
  PESQUISA_JURIDICA: "Em pesquisa jurídica",
  ELABORACAO: "Em elaboração",
  REVISAO: "Em revisão",
  AGUARDANDO_VEREADOR: "Aguardando validação do vereador",
  APROVADA_INTERNAMENTE: "Aprovada internamente",
  PRONTA_PROTOCOLO: "Pronta para protocolo",
  PROTOCOLADA: "Protocolada",
  EM_TRAMITACAO: "Em tramitação",
  APROVADA: "Aprovada",
  LEI: "Transformada em lei",
  ARQUIVADA: "Arquivada",
  SUSPENSA: "Suspensa",
};

export const COR_ETAPA: Record<EtapaOportunidade, "vermelho" | "amarelo" | "azul" | "cinza" | "verde"> = {
  IDEIA: "cinza", ANALISE_POLITICA: "azul", PESQUISA_JURIDICA: "azul", ELABORACAO: "azul", REVISAO: "azul",
  AGUARDANDO_VEREADOR: "amarelo", APROVADA_INTERNAMENTE: "verde", PRONTA_PROTOCOLO: "verde", PROTOCOLADA: "verde",
  EM_TRAMITACAO: "amarelo", APROVADA: "verde", LEI: "verde", ARQUIVADA: "cinza", SUSPENSA: "vermelho",
};

/** Da validação do vereador em diante (e arquivar/suspender) só a coordenação move. */
export const ETAPAS_COORDENACAO: ReadonlySet<EtapaOportunidade> = new Set([
  "APROVADA_INTERNAMENTE", "PRONTA_PROTOCOLO", "PROTOCOLADA", "EM_TRAMITACAO", "APROVADA", "LEI", "ARQUIVADA", "SUSPENSA",
]);

export const TEXTOS_OPORTUNIDADE: { tipo: TipoTextoOportunidade; rotulo: string; coordenacao?: boolean }[] = [
  { tipo: "TEXTO_INICIAL", rotulo: "Texto inicial do projeto" },
  { tipo: "JUSTIFICATIVA", rotulo: "Justificativa legislativa" },
  { tipo: "FUNDAMENTACAO_CONSTITUCIONAL", rotulo: "Fundamentação constitucional" },
  { tipo: "FUNDAMENTACAO_MUNICIPAL", rotulo: "Fundamentação na legislação municipal" },
  { tipo: "PARECER_JURIDICO", rotulo: "Parecer jurídico interno" },
  { tipo: "SUGESTOES_EQUIPE", rotulo: "Sugestões da equipe" },
  { tipo: "VERSAO_FINAL", rotulo: "Versão final aprovada", coordenacao: true },
];

export const ROTULO_TEXTO = Object.fromEntries(TEXTOS_OPORTUNIDADE.map((t) => [t.tipo, t.rotulo])) as Record<TipoTextoOportunidade, string>;

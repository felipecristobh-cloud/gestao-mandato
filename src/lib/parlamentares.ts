import type { CargoParlamentar, Esfera, TipoParticipacao } from "@prisma/client";
import { hojeISO, dataISO } from "@/lib/demandas";

export const CARGOS: CargoParlamentar[] = ["VEREADOR", "DEPUTADO_ESTADUAL", "DEPUTADO_FEDERAL", "SENADOR", "OUTRO"];
export const ESFERAS: Esfera[] = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];

export const ROTULO_CARGO: Record<CargoParlamentar, string> = {
  VEREADOR: "Vereador(a)",
  DEPUTADO_ESTADUAL: "Deputado(a) estadual",
  DEPUTADO_FEDERAL: "Deputado(a) federal",
  SENADOR: "Senador(a)",
  OUTRO: "Outro",
};

export const ROTULO_ESFERA: Record<Esfera, string> = { MUNICIPAL: "Municipal", ESTADUAL: "Estadual", FEDERAL: "Federal" };

/** Esfera é consequência do cargo; só "Outro" deixa escolher. */
export function esferaDoCargo(cargo: CargoParlamentar, escolhida?: Esfera | null): Esfera {
  switch (cargo) {
    case "VEREADOR": return "MUNICIPAL";
    case "DEPUTADO_ESTADUAL": return "ESTADUAL";
    case "DEPUTADO_FEDERAL": case "SENADOR": return "FEDERAL";
    default: return escolhida ?? "MUNICIPAL";
  }
}

export const TIPOS_PARTICIPACAO: TipoParticipacao[] = [
  "AUTOR", "COAUTOR", "ARTICULADOR", "PARCEIRO", "ACOMPANHAMENTO", "EXECUCAO", "INTERMEDIARIO",
];

export const ROTULO_PARTICIPACAO: Record<TipoParticipacao, string> = {
  AUTOR: "Autor",
  COAUTOR: "Coautor",
  ARTICULADOR: "Articulação",
  PARCEIRO: "Parceiro",
  ACOMPANHAMENTO: "Acompanhamento",
  EXECUCAO: "Responsável pela execução",
  INTERMEDIARIO: "Intermediário",
};

export const DESCRICAO_PARTICIPACAO: Record<TipoParticipacao, string> = {
  AUTOR: "Apresentou a emenda. Só existe quando cadastrado explicitamente.",
  COAUTOR: "Assina a emenda junto com o autor.",
  ARTICULADOR: "Articulou politicamente o recurso ou a solução.",
  PARCEIRO: "Mandato parceiro que apoia a pauta.",
  ACOMPANHAMENTO: "Acompanha a tramitação e a execução.",
  EXECUCAO: "Responsável por fazer a execução andar.",
  INTERMEDIARIO: "Fez a ponte entre as partes.",
};

/** Autoria e coautoria são exclusivas de emendas (Fase 4): demanda não tem autor parlamentar. */
export const TIPOS_PARTICIPACAO_DEMANDA: TipoParticipacao[] = ["ARTICULADOR", "PARCEIRO", "ACOMPANHAMENTO", "EXECUCAO", "INTERMEDIARIO"];

export type SituacaoMandato = "VIGENTE" | "ENCERRADO" | "FUTURO";

export function situacaoMandato(inicio: Date, fim: Date | null, hoje = hojeISO()): SituacaoMandato {
  if (dataISO(inicio) > hoje) return "FUTURO";
  if (fim && dataISO(fim) < hoje) return "ENCERRADO";
  return "VIGENTE";
}

export const ROTULO_SITUACAO: Record<SituacaoMandato, { texto: string; cor: "verde" | "cinza" | "azul" }> = {
  VIGENTE: { texto: "Vigente", cor: "verde" },
  ENCERRADO: { texto: "Encerrado", cor: "cinza" },
  FUTURO: { texto: "Futuro", cor: "azul" },
};

/** Dois períodos [inicio, fim] se cruzam? fim nulo = em aberto. */
export function periodosSobrepostos(a: { inicio: Date; fim: Date | null }, b: { inicio: Date; fim: Date | null }) {
  const fimA = a.fim?.getTime() ?? Infinity;
  const fimB = b.fim?.getTime() ?? Infinity;
  return a.inicio.getTime() <= fimB && b.inicio.getTime() <= fimA;
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

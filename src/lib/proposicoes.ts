import type { ParticipacaoProposicao, TipoProposicao, VerificacaoProposicao } from "@prisma/client";

/** Mandatos de Pedro Patrus como vereador de BH (confirmados pelo gabinete). */
export const MANDATOS_PEDRO = [
  { numero: 1, inicio: 2013, fim: 2016 },
  { numero: 2, inicio: 2017, fim: 2020 },
  { numero: 3, inicio: 2021, fim: 2024 },
  { numero: 4, inicio: 2025, fim: 2028 },
] as const;

export const ANO_MIN = MANDATOS_PEDRO[0].inicio;
export const ANO_MAX = MANDATOS_PEDRO[MANDATOS_PEDRO.length - 1].fim;

export function mandatoDoAno(ano: number) {
  return MANDATOS_PEDRO.find((m) => ano >= m.inicio && ano <= m.fim) ?? null;
}

export const rotuloMandatoPedro = (m: { numero: number; inicio: number; fim: number }) => `${m.numero}º mandato (${m.inicio}–${m.fim})`;

export const TIPOS_PROPOSICAO: TipoProposicao[] = [
  "PROJETO_LEI", "PROJETO_RESOLUCAO", "REQUERIMENTO", "INDICACAO", "PEDIDO_INFORMACAO", "EMENDA_PROJETO", "EMENDA_ORCAMENTARIA", "OUTRA",
];

export const ROTULO_TIPO_PROPOSICAO: Record<TipoProposicao, string> = {
  PROJETO_LEI: "Projeto de Lei",
  PROJETO_RESOLUCAO: "Projeto de Resolução",
  REQUERIMENTO: "Requerimento",
  INDICACAO: "Indicação",
  PEDIDO_INFORMACAO: "Pedido de informação",
  EMENDA_PROJETO: "Emenda a projeto",
  EMENDA_ORCAMENTARIA: "Emenda orçamentária",
  OUTRA: "Outra proposição",
};

export const SIGLA_TIPO_PROPOSICAO: Record<TipoProposicao, string> = {
  PROJETO_LEI: "PL", PROJETO_RESOLUCAO: "PR", REQUERIMENTO: "REQ", INDICACAO: "IND", PEDIDO_INFORMACAO: "PI",
  EMENDA_PROJETO: "EMD", EMENDA_ORCAMENTARIA: "EO", OUTRA: "OUT",
};

export const PARTICIPACOES: ParticipacaoProposicao[] = ["AUTORIA", "COAUTORIA", "EMENDA", "DISCUSSAO"];

export const ROTULO_PARTICIPACAO_PROPOSICAO: Record<ParticipacaoProposicao, string> = {
  AUTORIA: "Autoria individual",
  COAUTORIA: "Coautoria",
  EMENDA: "Participação em emenda",
  DISCUSSAO: "Participação em discussão",
};

export const VERIFICACOES: VerificacaoProposicao[] = ["CONFIRMADO", "AGUARDANDO", "INCOMPLETO", "CORRIGIDO"];

export const ROTULO_VERIFICACAO: Record<VerificacaoProposicao, string> = {
  CONFIRMADO: "Confirmado em fonte oficial",
  AGUARDANDO: "Aguardando conferência",
  INCOMPLETO: "Informação incompleta",
  CORRIGIDO: "Informação corrigida",
};

export const COR_VERIFICACAO: Record<VerificacaoProposicao, "verde" | "amarelo" | "vermelho" | "azul"> = {
  CONFIRMADO: "verde", AGUARDANDO: "amarelo", INCOMPLETO: "vermelho", CORRIGIDO: "azul",
};

export const rotuloProposicao = (p: { tipo: TipoProposicao; numero: number; ano: number }) => `${SIGLA_TIPO_PROPOSICAO[p.tipo]} ${p.numero}/${p.ano}`;

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const APELIDOS_TIPO: Record<string, TipoProposicao> = {
  pl: "PROJETO_LEI", "projeto de lei": "PROJETO_LEI", "projeto lei": "PROJETO_LEI",
  pr: "PROJETO_RESOLUCAO", "projeto de resolucao": "PROJETO_RESOLUCAO",
  req: "REQUERIMENTO", rq: "REQUERIMENTO", requerimento: "REQUERIMENTO",
  ind: "INDICACAO", indicacao: "INDICACAO",
  pi: "PEDIDO_INFORMACAO", "pedido de informacao": "PEDIDO_INFORMACAO", "pedido de informacoes": "PEDIDO_INFORMACAO",
  emd: "EMENDA_PROJETO", emenda: "EMENDA_PROJETO", "emenda a projeto": "EMENDA_PROJETO", "emenda parlamentar": "EMENDA_PROJETO",
  eo: "EMENDA_ORCAMENTARIA", "emenda orcamentaria": "EMENDA_ORCAMENTARIA",
  out: "OUTRA", outra: "OUTRA", "outra proposicao": "OUTRA",
};

/** Aceita o código (PROJETO_LEI), a sigla (PL) ou o nome por extenso ("Projeto de Lei"). */
export function tipoProposicaoDe(v: string): TipoProposicao | null {
  const t = v.trim();
  if ((TIPOS_PROPOSICAO as string[]).includes(t.toUpperCase())) return t.toUpperCase() as TipoProposicao;
  return APELIDOS_TIPO[semAcento(t)] ?? null;
}

const APELIDOS_PARTICIPACAO: Record<string, ParticipacaoProposicao> = {
  autoria: "AUTORIA", autor: "AUTORIA", "autoria individual": "AUTORIA",
  coautoria: "COAUTORIA", coautor: "COAUTORIA",
  emenda: "EMENDA", "participacao em emenda": "EMENDA",
  discussao: "DISCUSSAO", "participacao em discussao": "DISCUSSAO",
};

export function participacaoDe(v: string): ParticipacaoProposicao | null {
  const t = v.trim();
  if ((PARTICIPACOES as string[]).includes(t.toUpperCase())) return t.toUpperCase() as ParticipacaoProposicao;
  return APELIDOS_PARTICIPACAO[semAcento(t)] ?? null;
}

const APELIDOS_VERIFICACAO: Record<string, VerificacaoProposicao> = {
  confirmado: "CONFIRMADO", "confirmado em fonte oficial": "CONFIRMADO",
  aguardando: "AGUARDANDO", "aguardando conferencia": "AGUARDANDO",
  incompleto: "INCOMPLETO", "informacao incompleta": "INCOMPLETO",
  corrigido: "CORRIGIDO", "informacao corrigida": "CORRIGIDO",
};

export function verificacaoDe(v: string): VerificacaoProposicao | null {
  const t = v.trim();
  if ((VERIFICACOES as string[]).includes(t.toUpperCase())) return t.toUpperCase() as VerificacaoProposicao;
  return APELIDOS_VERIFICACAO[semAcento(t)] ?? null;
}

export { semAcento };

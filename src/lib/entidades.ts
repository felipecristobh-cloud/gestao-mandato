import type { TipoEntidade } from "@prisma/client";

export const TIPOS_ENTIDADE: TipoEntidade[] = [
  "ASSOCIACAO", "OSC", "COLETIVO", "ESCOLA", "SAUDE", "RELIGIOSA", "COOPERATIVA", "SINDICATO", "EMPRESA", "ORGAO_PUBLICO", "OUTRO",
];

export const ROTULO_TIPO_ENTIDADE: Record<TipoEntidade, string> = {
  ASSOCIACAO: "Associação comunitária",
  OSC: "OSC / ONG",
  COLETIVO: "Coletivo / movimento",
  ESCOLA: "Escola / caixa escolar",
  SAUDE: "Saúde",
  RELIGIOSA: "Religiosa",
  COOPERATIVA: "Cooperativa",
  SINDICATO: "Sindicato",
  EMPRESA: "Empresa",
  ORGAO_PUBLICO: "Órgão público",
  OUTRO: "Outro",
};

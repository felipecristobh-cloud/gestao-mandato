import type { Prioridade, StatusDemanda, TipoDemanda, TipoHistorico } from "@prisma/client";

export const STATUS: StatusDemanda[] = [
  "NOVA", "EM_ANALISE", "ENCAMINHADA", "AGUARDANDO_RETORNO", "EM_ANDAMENTO", "RESOLVIDA", "NAO_RESOLVIDA", "CANCELADA",
];
export const STATUS_FINAIS: StatusDemanda[] = ["RESOLVIDA", "NAO_RESOLVIDA", "CANCELADA"];
export const STATUS_ABERTOS: StatusDemanda[] = STATUS.filter((s) => !STATUS_FINAIS.includes(s));
export const TIPOS: TipoDemanda[] = ["SOLICITACAO", "RECLAMACAO", "DENUNCIA", "SUGESTAO", "PEDIDO_INFORMACAO", "OUTRO"];
export const PRIORIDADES: Prioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

export const ROTULO_STATUS: Record<StatusDemanda, string> = {
  NOVA: "Nova",
  EM_ANALISE: "Em análise",
  ENCAMINHADA: "Encaminhada",
  AGUARDANDO_RETORNO: "Aguardando retorno",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
  NAO_RESOLVIDA: "Não resolvida",
  CANCELADA: "Cancelada",
};

export const COR_STATUS: Record<StatusDemanda, "cinza" | "verde" | "vermelho" | "azul" | "amarelo"> = {
  NOVA: "azul",
  EM_ANALISE: "azul",
  ENCAMINHADA: "amarelo",
  AGUARDANDO_RETORNO: "amarelo",
  EM_ANDAMENTO: "amarelo",
  RESOLVIDA: "verde",
  NAO_RESOLVIDA: "vermelho",
  CANCELADA: "cinza",
};

export const ROTULO_TIPO: Record<TipoDemanda, string> = {
  SOLICITACAO: "Solicitação",
  RECLAMACAO: "Reclamação",
  DENUNCIA: "Denúncia",
  SUGESTAO: "Sugestão",
  PEDIDO_INFORMACAO: "Pedido de informação",
  OUTRO: "Outro",
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" };

export const ROTULO_HISTORICO: Record<TipoHistorico, string> = {
  CRIACAO: "Cadastro",
  EDICAO: "Edição",
  STATUS: "Status",
  RESPONSAVEL: "Responsável",
  ENCAMINHAMENTO: "Encaminhamento",
  RETORNO: "Retorno do órgão",
  COMENTARIO: "Comentário",
  ARTICULACAO: "Articulação com mandato",
};

/** Data de hoje (YYYY-MM-DD) no fuso de Belo Horizonte. */
export function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Datas sem hora (campos @db.Date) são guardadas como meia-noite UTC. */
export const dataISO = (d: Date) => d.toISOString().slice(0, 10);
export const deISO = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const somarDias = (iso: string, n: number) => dataISO(new Date(deISO(iso).getTime() + n * 86_400_000));
export const formatarData = (d: Date | null | undefined) => (d ? dataISO(d).split("-").reverse().join("/") : "—");

export type SituacaoPrazo = "CONCLUIDA" | "SEM_PRAZO" | "ATRASADA" | "HOJE" | "ATE_7" | "ATE_15" | "ATE_30" | "NO_PRAZO";

export function situacaoPrazo(prazo: Date | null, status: StatusDemanda, hoje = hojeISO()): { situacao: SituacaoPrazo; dias: number | null } {
  if (STATUS_FINAIS.includes(status)) return { situacao: "CONCLUIDA", dias: null };
  if (!prazo) return { situacao: "SEM_PRAZO", dias: null };
  const dias = Math.round((prazo.getTime() - deISO(hoje).getTime()) / 86_400_000);
  if (dias < 0) return { situacao: "ATRASADA", dias };
  if (dias === 0) return { situacao: "HOJE", dias };
  if (dias <= 7) return { situacao: "ATE_7", dias };
  if (dias <= 15) return { situacao: "ATE_15", dias };
  if (dias <= 30) return { situacao: "ATE_30", dias };
  return { situacao: "NO_PRAZO", dias };
}

export function rotuloPrazo({ situacao, dias }: ReturnType<typeof situacaoPrazo>) {
  switch (situacao) {
    case "ATRASADA": return { texto: `Atrasada ${-dias!} dia${dias === -1 ? "" : "s"}`, cor: "vermelho" as const };
    case "HOJE": return { texto: "Vence hoje", cor: "vermelho" as const };
    case "ATE_7": return { texto: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, cor: "amarelo" as const };
    case "ATE_15":
    case "ATE_30": return { texto: `Vence em ${dias} dias`, cor: "azul" as const };
    case "NO_PRAZO": return { texto: "No prazo", cor: "cinza" as const };
    case "SEM_PRAZO": return { texto: "Sem prazo", cor: "cinza" as const };
    case "CONCLUIDA": return { texto: "Concluída", cor: "verde" as const };
  }
}

export const FILTROS_PRAZO = [
  ["atrasadas", "Atrasadas"],
  ["hoje", "Vencem hoje"],
  ["7", "Vencem em até 7 dias"],
  ["15", "Vencem em até 15 dias"],
  ["30", "Vencem em até 30 dias"],
  ["sem", "Sem prazo"],
] as const;
export type FiltroPrazo = (typeof FILTROS_PRAZO)[number][0];

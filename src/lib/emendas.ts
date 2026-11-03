import type { StatusEmenda, TipoDocumentoEmenda, TipoEmenda, TipoHistoricoEmenda, TipoLancamento } from "@prisma/client";

export const STATUS_EMENDA: StatusEmenda[] = [
  "EM_NEGOCIACAO", "EM_ELABORACAO", "INDICADA", "PROTOCOLADA", "APROVADA", "EM_ANALISE", "IMPEDIMENTO_TECNICO",
  "EMPENHADA", "EM_EXECUCAO", "LIQUIDADA", "PAGA", "CONCLUIDA", "CANCELADA",
];
export const STATUS_EMENDA_FINAIS: StatusEmenda[] = ["CONCLUIDA", "CANCELADA"];
/** Antes do empenho: o primeiro empenho leva a emenda para "Empenhada". */
export const STATUS_ANTES_EMPENHO: StatusEmenda[] = ["EM_NEGOCIACAO", "EM_ELABORACAO", "INDICADA", "PROTOCOLADA", "APROVADA", "EM_ANALISE"];
export const STATUS_EXIGE_MOTIVO: StatusEmenda[] = ["CANCELADA", "IMPEDIMENTO_TECNICO"];

export const ROTULO_STATUS_EMENDA: Record<StatusEmenda, string> = {
  EM_NEGOCIACAO: "Em negociação",
  EM_ELABORACAO: "Em elaboração",
  INDICADA: "Indicada",
  PROTOCOLADA: "Protocolada",
  APROVADA: "Aprovada",
  EM_ANALISE: "Em análise",
  IMPEDIMENTO_TECNICO: "Impedimento técnico",
  EMPENHADA: "Empenhada",
  EM_EXECUCAO: "Em execução",
  LIQUIDADA: "Liquidada",
  PAGA: "Paga",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const COR_STATUS_EMENDA: Record<StatusEmenda, "cinza" | "verde" | "vermelho" | "azul" | "amarelo"> = {
  EM_NEGOCIACAO: "azul",
  EM_ELABORACAO: "azul",
  INDICADA: "azul",
  PROTOCOLADA: "azul",
  APROVADA: "azul",
  EM_ANALISE: "amarelo",
  IMPEDIMENTO_TECNICO: "vermelho",
  EMPENHADA: "amarelo",
  EM_EXECUCAO: "amarelo",
  LIQUIDADA: "amarelo",
  PAGA: "verde",
  CONCLUIDA: "verde",
  CANCELADA: "cinza",
};

export const TIPOS_EMENDA: TipoEmenda[] = ["INDIVIDUAL", "BANCADA", "COMISSAO", "RELATOR", "OUTRO"];
export const ROTULO_TIPO_EMENDA: Record<TipoEmenda, string> = {
  INDIVIDUAL: "Individual", BANCADA: "Bancada", COMISSAO: "Comissão", RELATOR: "Relator", OUTRO: "Outro",
};

export const TIPOS_LANCAMENTO: TipoLancamento[] = ["EMPENHO", "LIQUIDACAO", "PAGAMENTO"];
export const ROTULO_LANCAMENTO: Record<TipoLancamento, string> = { EMPENHO: "Empenho", LIQUIDACAO: "Liquidação", PAGAMENTO: "Pagamento" };

export const TIPOS_DOCUMENTO: TipoDocumentoEmenda[] = ["OFICIO", "PROCESSO", "PLANO_TRABALHO", "NOTA_EMPENHO", "TERMO", "COMPROVANTE", "OUTRO"];
export const ROTULO_DOCUMENTO: Record<TipoDocumentoEmenda, string> = {
  OFICIO: "Ofício", PROCESSO: "Processo (SEI etc.)", PLANO_TRABALHO: "Plano de trabalho", NOTA_EMPENHO: "Nota de empenho",
  TERMO: "Termo / convênio", COMPROVANTE: "Comprovante", OUTRO: "Outro",
};

export const ROTULO_HISTORICO_EMENDA: Record<TipoHistoricoEmenda, string> = {
  CRIACAO: "Cadastro", EDICAO: "Edição", STATUS: "Status", RESPONSAVEL: "Responsável", EXECUCAO: "Execução financeira",
  MANDATO: "Mandatos", DOCUMENTO: "Documento", COMENTARIO: "Comentário",
};

// ---------- dinheiro (sempre em centavos inteiros) ----------

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 10". Devolve centavos, null se vazio, NaN se inválido. */
export function lerValor(texto: string | null | undefined): number | null {
  const t = (texto ?? "").replace(/R\$|\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return NaN;
  const [inteiro, dec = ""] = normal.split(".");
  return Number(inteiro) * 100 + Number(dec.padEnd(2, "0"));
}

/** Decimal do Prisma, número ou string "123.45" → centavos. */
export function centavos(v: { toString(): string } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const [i, d = ""] = v.toString().split(".");
  const neg = i.startsWith("-");
  const c = Math.abs(Number(i)) * 100 + Number(d.padEnd(2, "0").slice(0, 2));
  return neg ? -c : c;
}

export const decimalDe = (c: number) => (c / 100).toFixed(2);

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarMoeda = (c: number) => moeda.format(c / 100);
/** Para preencher campos de formulário: 123456 → "1234,56". */
export const valorParaCampo = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

export type Valores = { indicado: number; aprovado: number | null; empenhado: number; liquidado: number; pago: number };

/** Saldos derivados. Saldo principal = a pagar do que já foi empenhado. */
export function resumoFinanceiro(v: Valores) {
  const base = v.aprovado ?? v.indicado;
  return {
    base,
    aEmpenhar: Math.max(0, base - v.empenhado),
    aLiquidar: v.empenhado - v.liquidado,
    aPagarLiquidado: v.liquidado - v.pago,
    saldo: v.empenhado - v.pago,
    percentualPago: base > 0 ? Math.round((v.pago / base) * 1000) / 10 : 0,
  };
}

/** Regras para os valores fecharem: pago ≤ liquidado ≤ empenhado ≤ aprovado. */
export function erroValores(v: Valores): string | null {
  if ([v.indicado, v.empenhado, v.liquidado, v.pago, v.aprovado ?? 0].some((x) => x < 0)) return "Valores não podem ser negativos.";
  if (v.liquidado > v.empenhado) return "O valor liquidado não pode passar do empenhado.";
  if (v.pago > v.liquidado) return "O valor pago não pode passar do liquidado.";
  if (v.aprovado !== null && v.empenhado > v.aprovado) return "O valor empenhado não pode passar do aprovado.";
  return null;
}

/** Soma dos lançamentos por tipo, em centavos. */
export function totaisLancamentos(ls: { tipo: TipoLancamento; valor: { toString(): string } | number }[]) {
  const t = { empenhado: 0, liquidado: 0, pago: 0 };
  for (const l of ls) {
    const c = centavos(l.valor);
    if (l.tipo === "EMPENHO") t.empenhado += c;
    else if (l.tipo === "LIQUIDACAO") t.liquidado += c;
    else t.pago += c;
  }
  return t;
}

// ---------- CNPJ ----------

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, ...PESOS_1];

function digito(base: string, pesos: number[]) {
  const s = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0) % 11;
  return s < 2 ? 0 : 11 - s;
}

/** Completa 12 dígitos com os 2 verificadores. */
export function completarCnpj(doze: string) {
  const d1 = digito(doze, PESOS_1);
  return `${doze}${d1}${digito(`${doze}${d1}`, PESOS_2)}`;
}

export const somenteDigitos = (v: string) => v.replace(/\D/g, "");

export function cnpjValido(v: string) {
  const d = somenteDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  return completarCnpj(d.slice(0, 12)) === d;
}

export const formatarCnpj = (d: string | null | undefined) =>
  d && d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d ?? "";

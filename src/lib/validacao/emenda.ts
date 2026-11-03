import { z } from "zod";
import { ESFERAS, TIPOS_PARTICIPACAO } from "@/lib/parlamentares";
import { STATUS_EMENDA, TIPOS_DOCUMENTO, TIPOS_EMENDA, TIPOS_LANCAMENTO, cnpjValido, lerValor, somenteDigitos } from "@/lib/emendas";
import { dataOpcional } from "@/lib/validacao/demanda";

const opcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);

const idInteiro = (msg: string) =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), msg);

const uuidOpcional = z.string().trim().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Identificador inválido.");

/** Valor em reais digitado (aceita vírgula) → centavos. */
const dinheiro = (rotulo: string) => z.union([z.string(), z.number()]).optional().nullable()
  .transform((v) => (typeof v === "number" ? Math.round(v * 100) : lerValor(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v <= 999_999_999_999), `${rotulo}: valor inválido (use 1.234,56).`);

export const emendaSchema = z.object({
  numero: opcional(40),
  ano: z.union([z.string(), z.number()]).transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 2000 && v <= 2100, "Informe o ano da emenda."),
  esfera: z.enum(ESFERAS as [string, ...string[]], { message: "Escolha a esfera." }),
  tipo: z.enum(TIPOS_EMENDA as [string, ...string[]]).default("INDIVIDUAL"),
  objeto: z.string().trim().min(10, "Descreva o objeto da emenda (mínimo 10 caracteres).").max(2000),
  justificativa: opcional(4000),
  valorIndicado: dinheiro("Valor indicado").refine((v) => v !== null && v > 0, "Informe o valor indicado."),
  valorAprovado: dinheiro("Valor aprovado"),
  beneficiario: opcional(200),
  cnpj: z.string().trim().optional().nullable().transform((v) => (v ? somenteDigitos(v) : null))
    .refine((v) => v === null || cnpjValido(v), "CNPJ inválido."),
  orgaoId: idInteiro("Órgão inválido."),
  secretaria: opcional(200),
  municipio: opcional(80),
  bairroId: idInteiro("Bairro inválido."),
  programa: opcional(200),
  acaoOrcamentaria: opcional(200),
  prazo: dataOpcional,
  responsavelId: uuidOpcional,
  observacoes: opcional(4000),
});
export type EmendaEntrada = z.input<typeof emendaSchema>;

export const statusEmendaSchema = z.object({
  status: z.enum(STATUS_EMENDA as [string, ...string[]], { message: "Status inválido." }),
  comentario: opcional(2000),
});

export const lancamentoSchema = z.object({
  tipo: z.enum(TIPOS_LANCAMENTO as [string, ...string[]], { message: "Escolha o tipo de lançamento." }),
  valor: dinheiro("Valor").refine((v) => v !== null && v > 0, "Informe um valor maior que zero."),
  data: dataOpcional.refine((v) => v !== null, "Informe a data."),
  documento: opcional(80),
  observacoes: opcional(1000),
});

export const vinculoEmendaSchema = z.object({
  mandatoId: z.string().trim().refine((v) => /^[0-9a-f-]{36}$/i.test(v), "Escolha o mandato."),
  tipo: z.enum(TIPOS_PARTICIPACAO as [string, ...string[]], { message: "Escolha o tipo de participação." }),
  responsabilidade: opcional(200),
  dataInicio: dataOpcional,
  dataFim: dataOpcional,
  observacoes: opcional(1000),
}).refine((v) => !v.dataInicio || !v.dataFim || v.dataFim >= v.dataInicio, { message: "O fim da participação não pode ser antes do início.", path: ["dataFim"] });

export const documentoSchema = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO as [string, ...string[]], { message: "Escolha o tipo de documento." }),
  descricao: z.string().trim().min(3, "Descreva o documento.").max(300),
  numero: opcional(80),
  data: dataOpcional,
  url: z.string().trim().max(500).optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "O link precisa começar com http:// ou https://."),
});

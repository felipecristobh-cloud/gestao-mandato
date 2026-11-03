import { z } from "zod";
import { PRIORIDADES, STATUS, TIPOS } from "@/lib/demandas";

const opcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);

const idInteiro = (msg: string) =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), msg);

const uuidOpcional = z.string().trim().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Identificador inválido.");

export const dataOpcional = z.string().trim().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Data inválida.")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

export const solicitanteSchema = z.object({
  solicitanteNome: z.string().trim().min(3, "Informe o nome do solicitante.").max(120),
  telefone: opcional(30),
  email: z.string().trim().toLowerCase().max(160).optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail do solicitante inválido."),
});

export const demandaCamposSchema = z.object({
  endereco: opcional(200),
  bairroId: idInteiro("Bairro inválido."),
  temaId: idInteiro("Tema inválido.").refine((v) => v !== null, "Escolha o tema."),
  tipo: z.enum(TIPOS as [string, ...string[]]).default("SOLICITACAO"),
  descricao: z.string().trim().min(10, "Descreva a demanda (mínimo 10 caracteres).").max(4000),
  prioridade: z.enum(PRIORIDADES as [string, ...string[]]).default("MEDIA"),
  prazo: dataOpcional,
  responsavelId: uuidOpcional,
  orgaoId: idInteiro("Órgão inválido."),
  observacoes: opcional(4000),
});

export const demandaCriarSchema = demandaCamposSchema.merge(solicitanteSchema).extend({
  pessoaId: uuidOpcional,
  status: z.enum(STATUS as [string, ...string[]]).default("NOVA"),
});

export const demandaAtualizarSchema = demandaCamposSchema.merge(solicitanteSchema);

export const statusSchema = z.object({
  status: z.enum(STATUS as [string, ...string[]], { message: "Status inválido." }),
  comentario: opcional(2000),
});

export const encaminhamentoSchema = z.object({
  orgaoId: idInteiro("Órgão inválido.").refine((v) => v !== null, "Escolha o órgão."),
  protocolo: opcional(60),
  descricao: z.string().trim().min(5, "Descreva o encaminhamento.").max(2000),
  prazoRetorno: dataOpcional,
});

export const retornoSchema = z.object({
  retorno: z.string().trim().min(3, "Descreva o retorno do órgão.").max(2000),
  dataRetorno: dataOpcional,
});

export type DemandaCriar = z.input<typeof demandaCriarSchema>;
export type DemandaAtualizar = z.input<typeof demandaAtualizarSchema>;

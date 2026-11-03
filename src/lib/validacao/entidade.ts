import { z } from "zod";
import { TIPOS_ENTIDADE } from "@/lib/entidades";
import { cnpjValido, somenteDigitos } from "@/lib/emendas";
import { TIPOS_PARTICIPACAO_DEMANDA } from "@/lib/parlamentares";

const opcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);

const idInteiro = (msg: string) =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), msg);

export const cnpjOpcional = z.string().trim().optional().nullable().transform((v) => (v ? somenteDigitos(v) : null))
  .refine((v) => v === null || cnpjValido(v), "CNPJ inválido.");

export const entidadeSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome da entidade.").max(200),
  cnpj: cnpjOpcional,
  tipo: z.enum(TIPOS_ENTIDADE as [string, ...string[]], { message: "Escolha o tipo de entidade." }),
  temaId: idInteiro("Área de atuação inválida."),
  endereco: opcional(200),
  bairroId: idInteiro("Bairro inválido."),
  telefone: opcional(30),
  email: z.string().trim().toLowerCase().max(160).optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail inválido."),
  responsavel: opcional(120),
  observacoes: opcional(4000),
  ativo: z.union([z.boolean(), z.string()]).optional().transform((v) => v === undefined || v === true || v === "on" || v === "1" || v === "true"),
});
export type EntidadeEntrada = z.input<typeof entidadeSchema>;

export const vinculoEntidadeSchema = z.object({
  mandatoId: z.string().trim().refine((v) => /^[0-9a-f-]{36}$/i.test(v), "Escolha o mandato."),
  tipo: z.enum(TIPOS_PARTICIPACAO_DEMANDA as [string, ...string[]], { message: "Tipo de relação inválido (autoria só existe em emendas)." }),
  observacoes: opcional(1000),
});

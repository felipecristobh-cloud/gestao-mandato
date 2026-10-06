import { z } from "zod";
import { CARGOS, ESFERAS, TIPOS_PARTICIPACAO_DEMANDA, UFS } from "@/lib/parlamentares";
import { dataOpcional } from "@/lib/validacao/demanda";

const opcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);
const uf = z.string().trim().toUpperCase().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || UFS.includes(v), "UF inválida.");
const cargo = z.enum(CARGOS as [string, ...string[]], { message: "Escolha o cargo." });
const esfera = z.string().optional().nullable().transform((v) => v || null)
  .refine((v) => v === null || (ESFERAS as string[]).includes(v), "Esfera inválida.");

export const parlamentarSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do parlamentar.").max(120),
  cargo,
  esfera,
  partido: opcional(30),
  municipio: opcional(80),
  uf,
  telefone: opcional(30),
  email: z.string().trim().toLowerCase().max(160).optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail inválido."),
  observacoes: opcional(4000),
  ativo: z.union([z.boolean(), z.string()]).optional().transform((v) => v === undefined || v === true || v === "on" || v === "1" || v === "true"),
  proprio: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === "on" || v === "1" || v === "true"),
});
export type ParlamentarEntrada = z.input<typeof parlamentarSchema>;

export const mandatoSchema = z.object({
  cargo,
  esfera,
  legislatura: opcional(40),
  descricao: opcional(200),
  partido: opcional(30),
  municipio: opcional(80),
  uf,
  dataInicio: dataOpcional.refine((v) => v !== null, "Informe o início do mandato."),
  dataFim: dataOpcional,
  observacoes: opcional(2000),
}).refine((m) => !m.dataFim || !m.dataInicio || m.dataFim >= m.dataInicio, { message: "O fim do mandato não pode ser antes do início.", path: ["dataFim"] });
export type MandatoEntrada = z.input<typeof mandatoSchema>;

export const vinculoSchema = z.object({
  mandatoId: z.string().trim().refine((v) => /^[0-9a-f-]{36}$/i.test(v), "Escolha o mandato."),
  tipo: z.enum(TIPOS_PARTICIPACAO_DEMANDA as [string, ...string[]], { message: "Tipo de participação inválido para demanda." }),
  observacoes: opcional(1000),
});

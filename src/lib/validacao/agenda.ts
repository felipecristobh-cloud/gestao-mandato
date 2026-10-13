import { z } from "zod";
import { STATUS_COMPROMISSO, TIPOS_COMPROMISSO, TIPOS_VINCULO, deDataHoraLocal } from "@/lib/agenda";

const opcional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);
const ehUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

const idInteiro = (msg: string) =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), msg);

const dataHora = (msg: string) => z.string().trim().transform((v) => deDataHoraLocal(v)).refine((v) => v !== null, msg).transform((v) => v!);

const MAX_DURACAO_MS = 7 * 86_400_000;

export const compromissoSchema = z.object({
  titulo: z.string().trim().min(3, "Informe o título do compromisso.").max(200),
  tipo: z.enum(TIPOS_COMPROMISSO as [string, ...string[]], { message: "Escolha o tipo de compromisso." }),
  inicio: dataHora("Informe data e hora de início."),
  fim: dataHora("Informe data e hora de término."),
  local: opcional(200),
  bairroId: idInteiro("Bairro inválido."),
  pauta: opcional(4000),
  agendaVereador: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === "on" || v === "1" || v === "true"),
  responsavelId: z.string().trim().optional().nullable().transform((v) => v || null).refine((v) => v === null || ehUuid(v), "Responsável inválido."),
  participantes: z.array(z.string().trim()).optional().default([])
    .transform((l) => [...new Set(l.filter(Boolean))])
    .refine((l) => l.every(ehUuid), "Participante inválido.")
    .refine((l) => l.length <= 30, "No máximo 30 participantes internos."),
})
  .refine((c) => c.fim > c.inicio, { message: "O término precisa ser depois do início.", path: ["fim"] })
  .refine((c) => c.fim.getTime() - c.inicio.getTime() <= MAX_DURACAO_MS, { message: "Um compromisso pode durar no máximo 7 dias.", path: ["fim"] });
export type CompromissoEntrada = z.input<typeof compromissoSchema>;

export const statusCompromissoSchema = z.object({
  status: z.enum(STATUS_COMPROMISSO as [string, ...string[]], { message: "Status inválido." }),
  motivo: opcional(2000),
});

export const resultadoSchema = z.object({
  resultado: z.string().trim().min(3, "Descreva o que foi tratado / decidido.").max(8000),
  encaminhamentos: opcional(4000),
});

export const alvoSchema = z.string().trim()
  .transform((v) => { const [tipo, id] = v.split(":"); return { tipo, id }; })
  .refine((a) => (TIPOS_VINCULO as readonly string[]).includes(a.tipo) && ehUuid(a.id ?? ""), "Escolha o registro a vincular.")
  .transform((a) => a as { tipo: (typeof TIPOS_VINCULO)[number]; id: string });

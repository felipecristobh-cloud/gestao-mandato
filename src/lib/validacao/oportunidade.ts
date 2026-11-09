import { z } from "zod";
import { PRIORIDADES_OPORTUNIDADE } from "@/lib/oportunidades";

const obrigatorio = (msg: string, max = 4000) => z.string({ message: msg }).trim().min(3, msg).max(max, `Máximo de ${max} caracteres.`);
const opcional = (max = 8000) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional().nullable().transform((v) => v || null);

const listaIds = (msg: string) =>
  z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional().nullable()
    .transform((v) => [...new Set((Array.isArray(v) ? v : (v ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean).map(Number))])
    .refine((l) => l.every((n) => Number.isInteger(n) && n > 0), msg);

export const oportunidadeSchema = z.object({
  nome: obrigatorio("Informe o nome da proposta.", 200),
  problema: obrigatorio("Descreva o problema social que a proposta enfrenta."),
  descricaoProblema: obrigatorio("Faça a descrição detalhada.", 8000),
  publico: obrigatorio("Informe o público beneficiado.", 1000),
  objetivo: obrigatorio("Informe o objetivo.", 2000),
  solucao: obrigatorio("Informe a solução legislativa proposta."),
  resultados: opcional(),
  fundamentacao: opcional(),
  legislacaoRelacionada: opcional(),
  projetosSemelhantes: opcional(),
  parceiros: opcional(2000),
  eixoId: z.union([z.string(), z.number()]).transform((v) => Number(v)).refine((v) => Number.isInteger(v) && v > 0, "Escolha o eixo temático."),
  responsavelId: z.string().trim().optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Responsável inválido."),
  bairroIds: listaIds("Bairro inválido."),
  regionalIds: listaIds("Regional inválida."),
});
export type OportunidadeEntrada = z.input<typeof oportunidadeSchema>;

const nota = (rotulo: string) =>
  z.union([z.string(), z.number()]).transform((v) => (v === "" ? NaN : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 5, `Dê uma nota de 0 a 5 para ${rotulo}.`);

export const avaliacaoSchema = z.object({
  notaImpacto: nota("impacto direto"),
  notaAlcance: nota("alcance social"),
  notaViabilidade: nota("viabilidade jurídica"),
  notaExecucao: nota("possibilidade de execução"),
  notaInovacao: nota("inovação legislativa"),
});
export type AvaliacaoEntrada = z.input<typeof avaliacaoSchema>;

export const prioridadeManualSchema = z.object({
  prioridade: z.string().optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || (PRIORIDADES_OPORTUNIDADE as string[]).includes(v), "Prioridade inválida."),
  justificativa: z.string({ message: "A justificativa é obrigatória." }).trim().min(10, "Escreva uma justificativa (mínimo de 10 caracteres).").max(2000),
});

export const eixoSchema = z.object({ nome: z.string().trim().min(3, "Informe o nome do eixo.").max(80) });

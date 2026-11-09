import { z } from "zod";
import { ANO_MAX, ANO_MIN, participacaoDe, tipoProposicaoDe, verificacaoDe } from "@/lib/proposicoes";

const opcional = (max = 8000) => z.union([z.string(), z.number()]).optional().nullable()
  .transform((v) => (v === null || v === undefined ? null : String(v).trim() || null))
  .refine((v) => v === null || v.length <= max, `Máximo de ${max} caracteres.`);

const inteiro = (msg: string) => z.union([z.string(), z.number()], { message: msg })
  .transform((v) => (typeof v === "number" ? v : /^\s*\d+\s*$/.test(v) ? Number(v) : NaN));

/** Aceita AAAA-MM-DD ou DD/MM/AAAA. Precisa cair dentro dos mandatos (2013–2028). */
export function lerData(v: string | null): Date | null | "invalida" {
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  let iso = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  if (!iso) {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso) return "invalida";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return "invalida";
  if (d.getUTCFullYear() < ANO_MIN || d.getUTCFullYear() > ANO_MAX) return "invalida";
  return d;
}

const data = (rotulo: string) => opcional(20).transform((v, ctx) => {
  const d = lerData(v);
  if (d === "invalida") {
    ctx.addIssue({ code: "custom", message: `${rotulo} inválida (use DD/MM/AAAA, entre ${ANO_MIN} e ${ANO_MAX}).` });
    return z.NEVER;
  }
  return d;
});

export const proposicaoSchema = z.object({
  tipo: z.string({ message: "Informe o tipo de proposição." }).transform((v, ctx) => {
    const t = tipoProposicaoDe(v);
    if (!t) { ctx.addIssue({ code: "custom", message: v.trim() ? `Tipo de proposição desconhecido: "${v.trim()}".` : "Informe o tipo de proposição." }); return z.NEVER; }
    return t;
  }),
  numero: inteiro("Informe o número.").refine((n) => Number.isInteger(n) && n > 0 && n <= 999999, "Número inválido: use só algarismos (ex.: 123)."),
  ano: inteiro("Informe o ano.").refine((n) => Number.isInteger(n) && n >= ANO_MIN && n <= ANO_MAX, `Ano fora dos mandatos (${ANO_MIN} a ${ANO_MAX}).`),
  ementa: z.string({ message: "Informe a ementa." }).trim().min(3, "Informe a ementa.").max(2000, "Ementa longa demais (máximo de 2000 caracteres)."),
  participacao: z.string({ message: "Informe a autoria/participação." }).transform((v, ctx) => {
    const p = participacaoDe(v);
    if (!p) { ctx.addIssue({ code: "custom", message: v.trim() ? `Autoria/participação desconhecida: "${v.trim()}".` : "Informe a autoria/participação." }); return z.NEVER; }
    return p;
  }),
  fonte: z.string({ message: "Identifique a fonte da informação." }).trim().min(3, "Identifique a fonte da informação.").max(500),
  verificacao: z.string().optional().nullable().transform((v, ctx) => {
    if (!v || !v.trim()) return "AGUARDANDO" as const;
    const s = verificacaoDe(v);
    if (!s) { ctx.addIssue({ code: "custom", message: `Estado de verificação desconhecido: "${v.trim()}".` }); return z.NEVER; }
    return s;
  }),
  descricao: opcional(),
  justificativa: opcional(20000),
  parlamentares: opcional(2000),
  dataApresentacao: data("Data de apresentação"),
  comissoes: opcional(2000),
  pareceres: opcional(),
  situacao: opcional(300),
  resultadoVotacao: opcional(2000),
  lei: opcional(300),
  dataConclusao: data("Data de aprovação/arquivamento"),
  linkOficial: opcional(500).refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), "Link oficial inválido (precisa começar com https://)."),
  observacoes: opcional(),
  eixoId: z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Eixo inválido."),
}).superRefine((d, ctx) => {
  if (d.verificacao === "CONFIRMADO" && !d.linkOficial) {
    ctx.addIssue({ code: "custom", path: ["linkOficial"], message: "Para marcar como confirmado em fonte oficial, informe o link oficial." });
  }
  if (d.dataApresentacao && d.dataConclusao && d.dataConclusao < d.dataApresentacao) {
    ctx.addIssue({ code: "custom", path: ["dataConclusao"], message: "A data de aprovação/arquivamento é anterior à apresentação." });
  }
});

export type ProposicaoEntrada = z.input<typeof proposicaoSchema>;
export type ProposicaoDados = z.output<typeof proposicaoSchema>;

/** Campos que, se vazios, deixam o registro incompleto (aviso, não erro). */
export const CAMPOS_RECOMENDADOS = [
  ["dataApresentacao", "data de apresentação"], ["situacao", "situação atual"], ["linkOficial", "link oficial"],
] as const;

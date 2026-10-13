export type TipoColuna = "texto" | "inteiro" | "moeda" | "data" | "percentual";

/** `razao`: coluna calculada (numerador ÷ denominador); no Excel vira fórmula. */
export type Coluna = {
  chave: string;
  titulo: string;
  tipo: TipoColuna;
  largura?: number;
  somar?: boolean;
  razao?: { num: string; den: string };
};

export type Valor = string | number | null;
export type Linha = Record<string, Valor>;

export type Relatorio = {
  titulo: string;
  filtros: string[];
  observacao?: string;
  colunas: Coluna[];
  linhas: Linha[];
  geradoEm: Date;
  geradoPor: string;
};

export type GrupoRelatorio = "demandas" | "emendas";

export const RELATORIOS = {
  "demandas-regional": { grupo: "demandas", titulo: "Demandas por regional" },
  "demandas-bairro": { grupo: "demandas", titulo: "Demandas por bairro" },
  "demandas-tema": { grupo: "demandas", titulo: "Demandas por tema" },
  "demandas-assessor": { grupo: "demandas", titulo: "Demandas por assessor" },
  "demandas-orgao": { grupo: "demandas", titulo: "Demandas por órgão" },
  "demandas-atrasadas": { grupo: "demandas", titulo: "Demandas atrasadas" },
  "demandas-resolvidas": { grupo: "demandas", titulo: "Demandas resolvidas" },
  "emendas-esfera": { grupo: "emendas", titulo: "Emendas por esfera" },
  "emendas-parlamentar": { grupo: "emendas", titulo: "Emendas por parlamentar (autoria)" },
  "emendas-mandato": { grupo: "emendas", titulo: "Emendas por mandato e participação" },
  "emendas-orgao": { grupo: "emendas", titulo: "Emendas por órgão" },
  "emendas-beneficiario": { grupo: "emendas", titulo: "Emendas por beneficiário" },
  "emendas-execucao": { grupo: "emendas", titulo: "Execução financeira" },
  "emendas-indicado": { grupo: "emendas", titulo: "Valores indicados" },
  "emendas-empenhado": { grupo: "emendas", titulo: "Valores empenhados" },
  "emendas-liquidado": { grupo: "emendas", titulo: "Valores liquidados" },
  "emendas-pago": { grupo: "emendas", titulo: "Valores pagos" },
} as const satisfies Record<string, { grupo: GrupoRelatorio; titulo: string }>;

export type TipoRelatorio = keyof typeof RELATORIOS;
export const ehTipoRelatorio = (v: unknown): v is TipoRelatorio => typeof v === "string" && Object.hasOwn(RELATORIOS, v);

export const FORMATOS = { csv: "CSV", xlsx: "Excel", pdf: "PDF" } as const;
export type Formato = keyof typeof FORMATOS;
export const ehFormato = (v: unknown): v is Formato => typeof v === "string" && Object.hasOwn(FORMATOS, v);

/** Valor da célula para exibição: moeda em centavos, percentual em 0–100, data ISO. */
export function valorCalculado(l: Linha, c: Coluna): Valor {
  if (!c.razao) return l[c.chave] ?? null;
  const n = Number(l[c.razao.num] ?? 0);
  const d = Number(l[c.razao.den] ?? 0);
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

export function totais(r: Relatorio): Linha | null {
  if (!r.colunas.some((c) => c.somar)) return null;
  const t: Linha = {};
  for (const c of r.colunas) {
    if (c.somar) t[c.chave] = r.linhas.reduce((s, l) => s + Number(l[c.chave] ?? 0), 0);
  }
  for (const c of r.colunas) if (c.razao) t[c.chave] = valorCalculado(t, c);
  t[r.colunas[0].chave] = "TOTAL";
  return t;
}

const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Texto para tela/PDF. */
export function formatarCelula(v: Valor, tipo: TipoColuna): string {
  if (v === null || v === "") return "—";
  if (typeof v === "string" && tipo !== "data") return v;
  switch (tipo) {
    case "moeda": return moedaFmt.format(Number(v) / 100);
    case "percentual": return `${pct.format(Number(v))}%`;
    case "data": return dataBR(String(v));
    case "inteiro": return String(v);
    default: return String(v);
  }
}

/** Texto para CSV (padrão do Excel brasileiro: `;` e vírgula decimal, sem símbolo de moeda). */
function celulaCSV(v: Valor, tipo: TipoColuna): string {
  if (v === null) return "";
  if (typeof v === "number") {
    if (tipo === "moeda") return num2.format(v / 100).replace(/\./g, "");
    if (tipo === "percentual") return String(v).replace(".", ",");
    return String(v);
  }
  if (tipo === "data") return dataBR(v);
  return v;
}

const escapar = (s: string) => (/[";\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s);

export function paraCSV(r: Relatorio): string {
  const linhas = [r.colunas.map((c) => escapar(c.titulo)).join(";")];
  const t = totais(r);
  for (const l of t ? [...r.linhas, t] : r.linhas) {
    linhas.push(r.colunas.map((c) => escapar(celulaCSV(valorCalculado(l, c), c.tipo))).join(";"));
  }
  return "\uFEFF" + linhas.join("\r\n") + "\r\n";
}

export function nomeArquivo(tipo: TipoRelatorio, formato: Formato, hoje: string) {
  return `relatorio-${tipo}-${hoje}.${formato}`;
}

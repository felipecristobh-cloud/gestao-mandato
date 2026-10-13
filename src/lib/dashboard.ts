export type Periodo = "12m" | "ano" | "tudo";
export const PERIODOS: [Periodo, string][] = [["12m", "Últimos 12 meses"], ["ano", "Este ano"], ["tudo", "Todo o período"]];
export const lerPeriodo = (v?: string): Periodo => (v === "ano" || v === "tudo" ? v : "12m");

/** Emenda sem histórico nem lançamento há este número de dias é considerada parada. */
export const DIAS_SEM_MOVIMENTACAO = 60;
export const DIAS_PRAZO_EMENDA = 30;
export const DIAS_PRAZO_DEMANDA = 7;

/** Primeiro dia (ISO) do período; null = sem limite. "12m" = mês atual + 11 anteriores. */
export function inicioPeriodo(p: Periodo, hoje: string): string | null {
  if (p === "tudo") return null;
  if (p === "ano") return `${hoje.slice(0, 4)}-01-01`;
  const [y, m] = hoje.split("-").map(Number);
  return new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);
}

/** Meses "AAAA-MM" de `de` até `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let [y, m] = de.split("-").map(Number);
  const [yf, mf] = ate.split("-").map(Number);
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

/** Percentual com uma casa; null quando o total é zero. */
export const percentual = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

export const formatarPercentual = (p: number | null) => (p === null ? "—" : `${p.toLocaleString("pt-BR")}%`);

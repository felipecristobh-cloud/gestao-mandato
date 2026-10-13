import type { StatusCompromisso, TipoCompromisso, TipoHistoricoCompromisso } from "@prisma/client";

export const TIPOS_COMPROMISSO: TipoCompromisso[] = [
  "REUNIAO", "VISITA", "PLENARIA", "AUDIENCIA", "EVENTO", "REUNIAO_INSTITUCIONAL", "REUNIAO_ENTIDADE", "ATIVIDADE_EXTERNA",
];

export const ROTULO_TIPO_COMPROMISSO: Record<TipoCompromisso, string> = {
  REUNIAO: "Reunião",
  VISITA: "Visita",
  PLENARIA: "Plenária",
  AUDIENCIA: "Audiência pública",
  EVENTO: "Evento",
  REUNIAO_INSTITUCIONAL: "Reunião institucional",
  REUNIAO_ENTIDADE: "Reunião com entidade",
  ATIVIDADE_EXTERNA: "Atividade externa",
};

export const STATUS_COMPROMISSO: StatusCompromisso[] = ["SOLICITADO", "CONFIRMADO", "REALIZADO", "ADIADO", "CANCELADO"];

export const ROTULO_STATUS_COMPROMISSO: Record<StatusCompromisso, string> = {
  SOLICITADO: "Solicitado",
  CONFIRMADO: "Confirmado",
  REALIZADO: "Realizado",
  ADIADO: "Adiado",
  CANCELADO: "Cancelado",
};

export const COR_STATUS_COMPROMISSO: Record<StatusCompromisso, "cinza" | "verde" | "vermelho" | "azul" | "amarelo"> = {
  SOLICITADO: "amarelo",
  CONFIRMADO: "verde",
  REALIZADO: "azul",
  ADIADO: "cinza",
  CANCELADO: "vermelho",
};

/** Adiado e cancelado não ocupam a agenda (não entram no aviso de choque). */
export const STATUS_OCUPA_AGENDA: StatusCompromisso[] = ["SOLICITADO", "CONFIRMADO", "REALIZADO"];
export const STATUS_EXIGE_MOTIVO_COMPROMISSO: StatusCompromisso[] = ["ADIADO", "CANCELADO"];

export const ROTULO_HISTORICO_COMPROMISSO: Record<TipoHistoricoCompromisso, string> = {
  CRIACAO: "Cadastro",
  EDICAO: "Edição",
  STATUS: "Status",
  VINCULO: "Vínculo",
  RESULTADO: "Resultado",
  COMENTARIO: "Comentário",
};

export const TIPOS_VINCULO = ["demanda", "emenda", "entidade", "parlamentar", "mandato"] as const;
export type TipoVinculo = (typeof TIPOS_VINCULO)[number];
export const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  demanda: "Demanda", emenda: "Emenda", entidade: "Entidade", parlamentar: "Parlamentar", mandato: "Mandato",
};

// ---------- datas e horas (Belo Horizonte) ----------

/** BH segue UTC−3 o ano todo (sem horário de verão desde 2019). */
export const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** "2026-10-05T14:30" digitado no formulário (hora de BH) → Date. */
export function deDataHoraLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const partes = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Date → "2026-10-05T14:30" (hora de BH), para preencher datetime-local. */
export function paraDataHoraLocal(d: Date): string {
  const p = Object.fromEntries(partes.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Dia em BH (AAAA-MM-DD) de um instante. */
export const diaLocal = (d: Date) => paraDataHoraLocal(d).slice(0, 10);
export const horaLocal = (d: Date) => paraDataHoraLocal(d).slice(11, 16);

/** Início do dia AAAA-MM-DD em BH, como instante. */
export const inicioDoDia = (iso: string) => new Date(`${iso}T00:00:00${OFFSET}`);

export function somarDiasISO(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana de `iso`. */
export function inicioSemana(iso: string) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return somarDiasISO(iso, dow === 0 ? -6 : 1 - dow);
}

export const inicioMes = (iso: string) => `${iso.slice(0, 7)}-01`;

export function somarMeses(iso: string, n: number) {
  const d = new Date(`${inicioMes(iso)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias exibidos no calendário mensal: semanas completas (seg–dom) que cobrem o mês. */
export function diasDoCalendario(iso: string) {
  const primeiro = inicioMes(iso);
  const ultimo = somarDiasISO(somarMeses(primeiro, 1), -1);
  const dias: string[] = [];
  for (let d = inicioSemana(primeiro); d <= ultimo || dias.length % 7 !== 0; d = somarDiasISO(d, 1)) dias.push(d);
  return dias;
}

/** Intervalos [a, b) se cruzam? Encostar (fim de um = início do outro) não é choque. */
export const intervalosCruzam = (a: { inicio: Date; fim: Date }, b: { inicio: Date; fim: Date }) =>
  a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

export function formatarPeriodo(inicio: Date, fim: Date) {
  const mesmoDia = diaLocal(inicio) === diaLocal(fim);
  return mesmoDia
    ? `${fmtData.format(inicio)}, ${horaLocal(inicio)}–${horaLocal(fim)}`
    : `${fmtData.format(inicio)} ${horaLocal(inicio)} → ${fmtData.format(fim)} ${horaLocal(fim)}`;
}

export const NOME_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const fmtMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
export const nomeMes = (iso: string) => fmtMes.format(new Date(`${inicioMes(iso)}T12:00:00Z`));
export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

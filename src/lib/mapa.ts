import { z } from "zod";
import type { StatusDemanda } from "@prisma/client";

/** Área aceita para pontos (Belo Horizonte com folga). */
export const LIMITES_BH = { latMin: -20.1, latMax: -19.7, lngMin: -44.15, lngMax: -43.8 } as const;
export const CENTRO_BH: [number, number] = [-19.9167, -43.9345];

export const dentroDeBH = (lat: number, lng: number) =>
  lat >= LIMITES_BH.latMin && lat <= LIMITES_BH.latMax && lng >= LIMITES_BH.lngMin && lng <= LIMITES_BH.lngMax;

export const coordenadaOpcional = (eixo: "lat" | "lng") =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && (eixo === "lat"
      ? v >= LIMITES_BH.latMin && v <= LIMITES_BH.latMax
      : v >= LIMITES_BH.lngMin && v <= LIMITES_BH.lngMax)), "Localização fora de Belo Horizonte.")
    .transform((v) => (v === null ? null : Math.round(v * 1e6) / 1e6));

export const COR_STATUS: Record<StatusDemanda, string> = {
  NOVA: "#2563eb",
  EM_ANALISE: "#7c3aed",
  ENCAMINHADA: "#0891b2",
  AGUARDANDO_RETORNO: "#d97706",
  EM_ANDAMENTO: "#0d9488",
  RESOLVIDA: "#16a34a",
  NAO_RESOLVIDA: "#64748b",
  CANCELADA: "#94a3b8",
};
export const COR_ATRASADA = "#dc2626";

export type PontoMapa = {
  id: string;
  protocolo: string;
  lat: number;
  lng: number;
  aproximado: boolean;
  status: StatusDemanda;
  atrasada: boolean;
  tema: string;
  bairro: string | null;
  regional: string | null;
  entrada: string;
  prazo: string | null;
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escaparHTML = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

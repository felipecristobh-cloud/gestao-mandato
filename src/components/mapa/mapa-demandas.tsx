"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as MapaLeaflet } from "leaflet";
import { ROTULO_STATUS } from "@/lib/demandas";
import { dataBR } from "@/lib/relatorios";
import { CENTRO_BH, COR_ATRASADA, COR_STATUS, escaparHTML as e, type PontoMapa } from "@/lib/mapa";

export const TILE_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const ATRIBUICAO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function resumo(p: PontoMapa) {
  const local = [p.bairro, p.regional].filter(Boolean).map((s) => e(s!)).join(" · ");
  return `<div style="min-width:190px;font-size:13px;line-height:1.4">
    <strong>${e(p.protocolo)}</strong><br/>
    ${e(p.tema)}<br/>
    <span style="color:${p.atrasada ? COR_ATRASADA : COR_STATUS[p.status]};font-weight:600">${e(ROTULO_STATUS[p.status])}${p.atrasada ? " · atrasada" : ""}</span><br/>
    ${local ? `${local}<br/>` : ""}
    Entrada ${e(dataBR(p.entrada))}${p.prazo ? ` · prazo ${e(dataBR(p.prazo))}` : ""}<br/>
    ${p.aproximado ? '<em style="color:#64748b">Localização aproximada (centro do bairro)</em><br/>' : ""}
    <a href="/demandas/${e(p.id)}">Abrir demanda →</a>
  </div>`;
}

export function MapaDemandas({ pontos }: { pontos: PontoMapa[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mapa: MapaLeaflet | undefined;
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !ref.current) return;
      mapa = L.map(ref.current).setView(CENTRO_BH, 12);
      L.tileLayer(TILE_OSM, { maxZoom: 19, attribution: ATRIBUICAO_OSM }).addTo(mapa);
      const grupo = L.featureGroup().addTo(mapa);
      for (const p of pontos) {
        L.circleMarker([p.lat, p.lng], {
          radius: 7, color: "#ffffff", weight: 1.5,
          fillColor: p.atrasada ? COR_ATRASADA : COR_STATUS[p.status],
          fillOpacity: p.aproximado ? 0.55 : 0.95,
        }).bindPopup(resumo(p)).addTo(grupo);
      }
      if (pontos.length) mapa.fitBounds(grupo.getBounds().pad(0.1), { maxZoom: 15 });
    });
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [pontos]);

  return <div ref={ref} className="z-0 h-[60vh] min-h-[380px] w-full rounded-lg" role="region" aria-label="Mapa das demandas" />;
}

"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as MapaLeaflet } from "leaflet";
import { Botao } from "@/components/ui";
import { CENTRO_BH, dentroDeBH } from "@/lib/mapa";
import { ATRIBUICAO_OSM, TILE_OSM } from "./mapa-demandas";

/** Marca a localização da demanda: busca o endereço no OpenStreetMap ou clique no mapa. */
export function SeletorLocal({ latitude, longitude }: { latitude?: string; longitude?: string }) {
  const [pos, setPos] = useState<[number, number] | null>(latitude && longitude ? [Number(latitude), Number(longitude)] : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const marca = useRef<CircleMarker | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((mod) => {
      if (cancelado || !ref.current) return;
      L.current = mod;
      const m = mod.map(ref.current).setView(pos ?? CENTRO_BH, pos ? 16 : 12);
      mod.tileLayer(TILE_OSM, { maxZoom: 19, attribution: ATRIBUICAO_OSM }).addTo(m);
      m.on("click", (ev) => {
        if (!dentroDeBH(ev.latlng.lat, ev.latlng.lng)) return setMsg("O ponto precisa estar em Belo Horizonte.");
        setMsg(null);
        setPos([Math.round(ev.latlng.lat * 1e6) / 1e6, Math.round(ev.latlng.lng * 1e6) / 1e6]);
      });
      mapa.current = m;
      setPos((p) => (p ? [...p] : p));
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !L.current) return;
    marca.current?.remove();
    marca.current = pos ? L.current.circleMarker(pos, { radius: 9, color: "#fff", weight: 2, fillColor: "#a51d1d", fillOpacity: 0.95 }).addTo(m) : null;
  }, [pos]);

  async function localizar() {
    const form = ref.current?.closest("form");
    const endereco = (form?.elements.namedItem("endereco") as HTMLInputElement | null)?.value ?? "";
    const bairroId = (form?.elements.namedItem("bairroId") as HTMLSelectElement | null)?.value ?? "";
    setBuscando(true);
    setMsg(null);
    try {
      const r = await fetch(`/mapa/geocodificar?${new URLSearchParams({ endereco, bairroId })}`);
      const j = await r.json();
      if (!r.ok) return setMsg(j.erro ?? "Não foi possível localizar.");
      setPos([j.lat, j.lng]);
      mapa.current?.setView([j.lat, j.lng], 17);
      setMsg(`Encontrado: ${j.descricao}. Se não for o lugar certo, clique no mapa.`);
    } catch {
      setMsg("Não foi possível localizar agora. Clique no mapa para marcar o ponto.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="latitude" value={pos ? String(pos[0]) : ""} />
      <input type="hidden" name="longitude" value={pos ? String(pos[1]) : ""} />
      <div className="flex flex-wrap items-center gap-2">
        <Botao type="button" variante="secundario" onClick={localizar} disabled={buscando}>
          {buscando ? "Localizando…" : "Localizar endereço"}
        </Botao>
        {pos && (
          <Botao type="button" variante="secundario" onClick={() => { setPos(null); setMsg(null); }}>
            Remover ponto
          </Botao>
        )}
        <span className="text-xs text-slate-500">
          {pos ? `Ponto: ${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}` : "Sem ponto: a demanda aparece no centro do bairro."}
        </span>
      </div>
      {msg && <p className="text-xs text-slate-600" role="status">{msg}</p>}
      <div ref={ref} className="z-0 h-64 w-full rounded-md border border-slate-200" aria-label="Clique no mapa para marcar o local da demanda" />
    </div>
  );
}

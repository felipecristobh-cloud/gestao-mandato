import { dentroDeBH, LIMITES_BH } from "@/lib/mapa";

export type ResultadoGeo = { lat: number; lng: number; descricao: string };

const URL_NOMINATIM = "https://nominatim.openstreetmap.org/search";
const INTERVALO_MS = 1100; // política de uso do Nominatim: no máximo 1 requisição por segundo
let proxima = 0;

/** Busca um endereço de BH no OpenStreetMap (Nominatim). Uso pontual, um endereço por clique. */
export async function geocodificar(
  endereco: string,
  bairro?: string | null,
  opts: { fetch?: typeof fetch; esperar?: boolean } = {},
): Promise<ResultadoGeo | null> {
  const q = [endereco.trim(), bairro?.trim(), "Belo Horizonte", "MG"].filter(Boolean).join(", ");
  if (opts.esperar !== false) {
    const agora = Date.now();
    const espera = Math.max(0, proxima - agora);
    proxima = Math.max(agora, proxima) + INTERVALO_MS;
    if (espera) await new Promise((r) => setTimeout(r, espera));
  }
  const params = new URLSearchParams({
    q, format: "jsonv2", limit: "1", countrycodes: "br", bounded: "1",
    viewbox: `${LIMITES_BH.lngMin},${LIMITES_BH.latMax},${LIMITES_BH.lngMax},${LIMITES_BH.latMin}`,
  });
  const resp = await (opts.fetch ?? fetch)(`${URL_NOMINATIM}?${params}`, {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT || "gestao-mandato/1.0 (gabinete do vereador Pedro Patrus)",
      "Accept-Language": "pt-BR",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`);
  const [r] = (await resp.json()) as { lat: string; lon: string; display_name: string }[];
  if (!r) return null;
  const lat = Math.round(Number(r.lat) * 1e6) / 1e6;
  const lng = Math.round(Number(r.lon) * 1e6) / 1e6;
  if (!dentroDeBH(lat, lng)) return null;
  return { lat, lng, descricao: r.display_name };
}

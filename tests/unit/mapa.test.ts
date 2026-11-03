import { describe, expect, it, vi } from "vitest";
import { coordenadaOpcional, dentroDeBH, escaparHTML } from "@/lib/mapa";
import { demandaCamposSchema } from "@/lib/validacao/demanda";
import { geocodificar } from "@/server/services/geocodificar";

describe("mapa — coordenadas", () => {
  it("aceita ponto de BH, vírgula decimal e vazio; recusa fora de BH", () => {
    const lat = coordenadaOpcional("lat");
    expect(lat.parse("-19,9167")).toBe(-19.9167);
    expect(lat.parse("")).toBeNull();
    expect(lat.safeParse("-23.55").success).toBe(false);
    expect(coordenadaOpcional("lng").safeParse("abc").success).toBe(false);
    expect(dentroDeBH(-19.92, -43.94)).toBe(true);
    expect(dentroDeBH(-19.92, -46.6)).toBe(false);
  });
  it("faz parte do schema da demanda", () => {
    const r = demandaCamposSchema.parse({ temaId: "1", descricao: "Descrição com tamanho suficiente", latitude: "-19.9", longitude: "-43.9" });
    expect([r.latitude, r.longitude]).toEqual([-19.9, -43.9]);
  });
  it("escapa HTML do popup", () => {
    expect(escaparHTML(`<img src=x onerror="a()">&'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  });
});

describe("mapa — geocodificação (Nominatim)", () => {
  it("monta a busca limitada a BH e devolve o ponto", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([{ lat: "-19.9148921", lon: "-43.9170461", display_name: "Santa Tereza, BH" }])));
    const r = await geocodificar("Rua Mármore, 100", "Santa Tereza", { fetch: f as unknown as typeof fetch, esperar: false });
    expect(r).toEqual({ lat: -19.914892, lng: -43.917046, descricao: "Santa Tereza, BH" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("bounded=1");
    expect(decodeURIComponent(url.replace(/\+/g, " "))).toContain("Rua Mármore, 100, Santa Tereza, Belo Horizonte, MG");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/gestao-mandato/);
  });
  it("ignora resultado fora de BH e vazio", async () => {
    const fora = vi.fn(async () => new Response(JSON.stringify([{ lat: "-23.5", lon: "-46.6", display_name: "SP" }])));
    expect(await geocodificar("Av. Paulista", null, { fetch: fora as unknown as typeof fetch, esperar: false })).toBeNull();
    const vazio = vi.fn(async () => new Response("[]"));
    expect(await geocodificar("xyz", null, { fetch: vazio as unknown as typeof fetch, esperar: false })).toBeNull();
  });
});

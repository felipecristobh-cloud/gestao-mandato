import { describe, expect, it, vi } from "vitest";
import { novaChave, storageDoAmbiente, storageSupabase } from "@/server/storage";

function fetchFalso() {
  const guardado = new Map<string, Uint8Array>();
  const f = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    const metodo = init.method ?? "GET";
    if (metodo === "POST") {
      guardado.set(u, init.body as Uint8Array);
      return new Response("{}", { status: 200 });
    }
    if (metodo === "DELETE") {
      const { prefixes } = JSON.parse(String(init.body));
      for (const p of prefixes) guardado.delete(`${u}/${p}`);
      return new Response("[]", { status: 200 });
    }
    const b = guardado.get(u);
    return b ? new Response(new Uint8Array(b), { status: 200 }) : new Response("nao", { status: 404 });
  });
  return { f, guardado };
}

describe("storage Supabase", () => {
  const cfg = { url: "https://abc.supabase.co/", chaveServico: "srv", bucket: "documentos" };

  it("salva cifrado, lê de volta e remove", async () => {
    const { f, guardado } = fetchFalso();
    const s = storageSupabase(cfg, f as unknown as typeof fetch);
    const chave = novaChave();
    await s.salvar(chave, Buffer.from("conteudo secreto"));
    const url = `https://abc.supabase.co/storage/v1/object/documentos/${chave}`;
    expect(Buffer.from(guardado.get(url)!).toString()).not.toContain("conteudo secreto");
    const init = f.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer srv");
    expect((await s.ler(chave)).toString()).toBe("conteudo secreto");
    await s.remover(chave);
    await expect(s.ler(chave)).rejects.toThrow("404");
  });

  it("recusa chave fora do formato", async () => {
    const s = storageSupabase(cfg, fetchFalso().f as unknown as typeof fetch);
    await expect(s.ler("../../segredo")).rejects.toThrow("inválida");
  });

  it("produção sem storage configurado falha cedo", () => {
    expect(() => storageDoAmbiente({ NODE_ENV: "production" })).toThrow("SUPABASE_URL");
    expect(() => storageDoAmbiente({ NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" })).not.toThrow();
  });
});

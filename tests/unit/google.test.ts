import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { configGoogle, emailDoGoogle, novoEstadoOAuth, redirectGoogle, urlAutorizacao } from "@/server/auth/google";

const cfg = { clientId: "cliente.apps.googleusercontent.com", clientSecret: "segredo" };
const estado = novoEstadoOAuth();
const jwt = (c: object) => ["e30", Buffer.from(JSON.stringify(c)).toString("base64url"), "assinatura"].join(".");
const valido = { iss: "https://accounts.google.com", aud: cfg.clientId, exp: Date.now() / 1000 + 300, email: "Fulana@Gmail.com", email_verified: true, nonce: estado.nonce };
const fetchCom = (c: object, ok = true) =>
  (async (_: unknown, init?: RequestInit) => {
    const corpo = new URLSearchParams(String(init?.body));
    expect(corpo.get("code_verifier")).toBe(estado.verifier);
    expect(corpo.get("client_secret")).toBe(cfg.clientSecret);
    return new Response(JSON.stringify({ id_token: jwt(c) }), { status: ok ? 200 : 400 });
  }) as typeof fetch;

describe("login com Google", () => {
  it("só fica ativo com as duas chaves", () => {
    expect(configGoogle({ GOOGLE_CLIENT_ID: "x" })).toBeNull();
    expect(configGoogle({ GOOGLE_CLIENT_ID: " x ", GOOGLE_CLIENT_SECRET: "y" })).toEqual({ clientId: "x", clientSecret: "y" });
  });

  it("monta a URL com PKCE S256, state e nonce", () => {
    const u = new URL(urlAutorizacao(cfg, "https://app/api/auth/google/callback", estado));
    expect(u.origin).toBe("https://accounts.google.com");
    expect(u.searchParams.get("state")).toBe(estado.state);
    expect(u.searchParams.get("nonce")).toBe(estado.nonce);
    expect(u.searchParams.get("code_challenge")).toBe(createHash("sha256").update(estado.verifier).digest("base64url"));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("APP_URL define o redirect", () => {
    expect(redirectGoogle("http://x", { APP_URL: "https://prod.app/" })).toBe("https://prod.app/api/auth/google/callback");
    expect(redirectGoogle("http://x", {})).toBe("http://x/api/auth/google/callback");
  });

  it("aceita id_token válido e normaliza o e-mail", async () => {
    expect(await emailDoGoogle(cfg, "r", "c", estado, fetchCom(valido))).toBe("fulana@gmail.com");
  });

  it.each([
    ["outro cliente", { aud: "outro" }],
    ["outro emissor", { iss: "https://evil.example" }],
    ["vencido", { exp: Date.now() / 1000 - 1 }],
    ["nonce diferente", { nonce: "outro" }],
    ["e-mail não verificado", { email_verified: false }],
  ])("recusa token: %s", async (_, mudanca) => {
    expect(await emailDoGoogle(cfg, "r", "c", estado, fetchCom({ ...valido, ...mudanca }))).toBeNull();
  });

  it("recusa quando o Google nega o código", async () => {
    expect(await emailDoGoogle(cfg, "r", "c", estado, fetchCom(valido, false))).toBeNull();
  });
});

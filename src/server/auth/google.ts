import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/server/db";
import { registrarAuditoria } from "@/server/audit";
import { hashSenha } from "./password";
import { criarSessao } from "./session";
import { JANELA_IP_MS, MAX_FALHAS_IP } from "./login";

export const COOKIE_OAUTH = "gm_google";
const AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const EMISSORES = ["https://accounts.google.com", "accounts.google.com"];

export type ConfigGoogle = { clientId: string; clientSecret: string };

export function configGoogle(env: Record<string, string | undefined> = process.env): ConfigGoogle | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** APP_URL fixa o endereço público (o mesmo cadastrado no Google); sem ela, usa a origem da requisição. */
export const redirectGoogle = (origem: string, env: Record<string, string | undefined> = process.env) =>
  `${env.APP_URL?.trim().replace(/\/$/, "") || origem}/api/auth/google/callback`;

export type EstadoOAuth = { state: string; verifier: string; nonce: string };

export function novoEstadoOAuth(): EstadoOAuth {
  const r = () => randomBytes(32).toString("base64url");
  return { state: r(), verifier: r(), nonce: r() };
}

/** URL do Google com PKCE (S256), state e nonce. */
export function urlAutorizacao(cfg: ConfigGoogle, redirectUri: string, e: EstadoOAuth) {
  const u = new URL(AUTORIZACAO);
  u.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: e.state,
    nonce: e.nonce,
    code_challenge: createHash("sha256").update(e.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

type Reivindicacoes = { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean | string; nonce?: string };

/**
 * Troca o código pelo id_token direto no endpoint do Google (TLS + client secret, como prevê o OIDC),
 * e confere emissor, público, validade, nonce e e-mail verificado. Devolve o e-mail ou null.
 */
export async function emailDoGoogle(
  cfg: ConfigGoogle,
  redirectUri: string,
  code: string,
  e: Pick<EstadoOAuth, "verifier" | "nonce">,
  f: typeof fetch = fetch,
): Promise<string | null> {
  const res = await f(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: e.verifier,
    }).toString(),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  const partes = id_token?.split(".");
  if (!partes || partes.length !== 3) return null;
  let c: Reivindicacoes;
  try {
    c = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const verificado = c.email_verified === true || c.email_verified === "true";
  if (!c.iss || !EMISSORES.includes(c.iss) || c.aud !== cfg.clientId) return null;
  if (!c.exp || c.exp * 1000 <= Date.now() || c.nonce !== e.nonce || !verificado || !c.email) return null;
  return c.email.trim().toLowerCase();
}

export type ResultadoGoogle =
  | { ok: true; token: string; expiraEm: Date }
  | { ok: false; motivo: "NAO_CADASTRADO" | "BLOQUEADO" | "BLOQUEADO_IP" };

/**
 * Só entra quem já tem conta ativa com o mesmo e-mail: o Google não cria usuário.
 * Se a conta ainda tinha senha provisória, ela é invalidada (troca de senha deixa de ser exigida).
 */
export async function autenticarGoogle(
  db: Db,
  email: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<ResultadoGoogle> {
  if (meta.ip) {
    const falhas = await db.auditLog.count({
      where: { acao: "LOGIN_FALHA", ip: meta.ip, data: { gte: new Date(Date.now() - JANELA_IP_MS) } },
    });
    if (falhas >= MAX_FALHAS_IP) return { ok: false, motivo: "BLOQUEADO_IP" };
  }
  const usuario = await db.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo || usuario.excluidoEm) {
    await registrarAuditoria(db, {
      usuarioId: usuario?.id ?? null, entidade: "usuario", registroId: usuario?.id ?? null, acao: "LOGIN_FALHA",
      descricao: usuario ? "Google: usuário inativo" : "Google: e-mail não cadastrado", ip: meta.ip,
    });
    return { ok: false, motivo: "NAO_CADASTRADO" };
  }
  if (usuario.bloqueadoAte && usuario.bloqueadoAte.getTime() > Date.now()) {
    await registrarAuditoria(db, {
      usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN_FALHA",
      descricao: "Google: tentativa durante bloqueio", ip: meta.ip,
    });
    return { ok: false, motivo: "BLOQUEADO" };
  }
  const senhaDescartada = usuario.trocarSenha ? await hashSenha(randomBytes(32).toString("base64url")) : null;
  const sessao = await db.$transaction(async (tx) => {
    const [atual] = await tx.$queryRaw<{ ativo: boolean }[]>`
      SELECT ativo FROM usuario WHERE id = ${usuario.id}::uuid FOR UPDATE`;
    if (!atual?.ativo) return null;
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        tentativasFalhas: 0, bloqueadoAte: null, ultimoLogin: new Date(),
        ...(senhaDescartada ? { senhaHash: senhaDescartada, trocarSenha: false } : {}),
      },
    });
    const s = await criarSessao(tx, usuario.id, meta);
    await registrarAuditoria(tx, {
      usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN",
      descricao: senhaDescartada ? "Google (senha provisória invalidada)" : "Google", ip: meta.ip,
    });
    return s;
  });
  if (!sessao) return { ok: false, motivo: "NAO_CADASTRADO" };
  return { ok: true, ...sessao };
}

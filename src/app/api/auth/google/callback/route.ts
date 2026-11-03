import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { COOKIE_OAUTH, autenticarGoogle, configGoogle, emailDoGoogle, redirectGoogle, type EstadoOAuth } from "@/server/auth/google";
import { COOKIE_SESSAO } from "@/server/auth/session";
import { metaRequisicao } from "@/server/auth/current";

export const dynamic = "force-dynamic";

function ler(valor?: string): EstadoOAuth | null {
  try {
    const e = JSON.parse(Buffer.from(valor ?? "", "base64url").toString("utf8"));
    return typeof e?.state === "string" && typeof e?.verifier === "string" && typeof e?.nonce === "string" ? e : null;
  } catch {
    return null;
  }
}

const iguais = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: NextRequest) {
  const sair = (erro: string) => {
    const r = NextResponse.redirect(new URL(`/login?erro=${erro}`, req.url));
    r.cookies.delete({ name: COOKIE_OAUTH, path: "/api/auth/google" });
    return r;
  };
  const cfg = configGoogle();
  if (!cfg) return sair("google_off");
  const estado = ler(req.cookies.get(COOKIE_OAUTH)?.value);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  if (!estado || !code || !iguais(state, estado.state)) return sair("google");

  const email = await emailDoGoogle(cfg, redirectGoogle(req.nextUrl.origin), code, estado);
  if (!email) return sair("google");
  const r = await autenticarGoogle(prisma, email, await metaRequisicao());
  if (!r.ok) return sair(r.motivo === "NAO_CADASTRADO" ? "google_sem_conta" : "bloqueado");

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.delete({ name: COOKIE_OAUTH, path: "/api/auth/google" });
  res.cookies.set(COOKIE_SESSAO, r.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: r.expiraEm,
  });
  return res;
}

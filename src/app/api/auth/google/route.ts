import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_OAUTH, configGoogle, novoEstadoOAuth, redirectGoogle, urlAutorizacao } from "@/server/auth/google";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const cfg = configGoogle();
  if (!cfg) return NextResponse.redirect(new URL("/login?erro=google_off", req.url));
  const estado = novoEstadoOAuth();
  const res = NextResponse.redirect(urlAutorizacao(cfg, redirectGoogle(req.nextUrl.origin), estado));
  res.cookies.set(COOKIE_OAUTH, Buffer.from(JSON.stringify(estado)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}

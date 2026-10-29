import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/api/health"];

/** CSP com nonce por requisição: só roda script emitido pelo próprio Next. Mapa: tiles do OpenStreetMap. */
export function politicaSeguranca(nonce: string, dev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Checagem otimista (só presença do cookie). A validação real da sessão acontece no servidor, em cada página e ação.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PUBLICAS.some((p) => pathname.startsWith(p)) && !req.cookies.get("gm_sessao")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = politicaSeguranca(nonce);
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: cabecalhos } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

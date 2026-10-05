import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/api/health"];

// Checagem otimista (só presença do cookie). A validação real da sessão acontece no servidor, em cada página e ação.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("gm_sessao")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

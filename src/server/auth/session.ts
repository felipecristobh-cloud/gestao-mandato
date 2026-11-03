import { createHash, randomBytes } from "node:crypto";
import type { Perfil } from "@prisma/client";
import type { Db, Tx } from "@/server/db";

export const COOKIE_SESSAO = "gm_sessao";
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
/** Sessão deslizante: com uso, o prazo volta a 7 dias (no máximo uma gravação por dia por sessão). */
const RENOVAR_APOS_MS = 24 * 60 * 60 * 1000;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  trocarSenha: boolean;
};

export function gerarToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function criarSessao(db: Db | Tx, usuarioId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await db.sessao.create({
    data: { id: hashToken(token), usuarioId, expiraEm, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
  });
  return { token, expiraEm };
}

/** Valida o token e relê o usuário no banco: usuário inativo ou sessão vencida perde o acesso na hora. */
export async function validarSessao(db: Db, token: string): Promise<UsuarioSessao | null> {
  const id = hashToken(token);
  const sessao = await db.sessao.findUnique({ where: { id }, include: { usuario: true } });
  if (!sessao) return null;
  if (sessao.expiraEm.getTime() <= Date.now() || !sessao.usuario.ativo) {
    await db.sessao.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  if (sessao.expiraEm.getTime() - Date.now() < DURACAO_SESSAO_MS - RENOVAR_APOS_MS) {
    await db.sessao
      .updateMany({ where: { id }, data: { expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS) } })
      .catch(() => undefined);
  }
  const { usuario } = sessao;
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, trocarSenha: usuario.trocarSenha };
}

export async function encerrarSessao(db: Db, token: string) {
  await db.sessao.deleteMany({ where: { id: hashToken(token) } });
}

export async function encerrarSessoesDoUsuario(db: Db, usuarioId: string) {
  await db.sessao.deleteMany({ where: { usuarioId } });
}

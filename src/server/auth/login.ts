import type { Db } from "@/server/db";
import { registrarAuditoria } from "@/server/audit";
import { hashSenha, verificarSenha } from "./password";
import { criarSessao } from "./session";

export const MAX_TENTATIVAS = 5;
export const BLOQUEIO_MS = 15 * 60 * 1000;

export type ResultadoLogin =
  | { ok: true; token: string; expiraEm: Date; trocarSenha: boolean }
  | { ok: false; motivo: "CREDENCIAIS" | "BLOQUEADO" };

let hashFalso: Promise<string> | undefined;

export async function autenticar(
  db: Db,
  emailBruto: string,
  senha: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<ResultadoLogin> {
  const email = emailBruto.trim().toLowerCase();
  const usuario = await db.usuario.findUnique({ where: { email } });

  if (!usuario || !usuario.ativo) {
    hashFalso ??= hashSenha("senha-inexistente-para-tempo-constante");
    await verificarSenha(await hashFalso, senha);
    await registrarAuditoria(db, {
      usuarioId: usuario?.id ?? null,
      entidade: "usuario",
      registroId: usuario?.id ?? null,
      acao: "LOGIN_FALHA",
      descricao: usuario ? "Usuário inativo" : "E-mail não cadastrado",
      ip: meta.ip,
    });
    return { ok: false, motivo: "CREDENCIAIS" };
  }

  if (usuario.bloqueadoAte && usuario.bloqueadoAte.getTime() > Date.now()) {
    await registrarAuditoria(db, {
      usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN_FALHA",
      descricao: "Tentativa durante bloqueio", ip: meta.ip,
    });
    return { ok: false, motivo: "BLOQUEADO" };
  }

  const valida = await verificarSenha(usuario.senhaHash, senha);
  if (!valida) {
    const tentativas = usuario.tentativasFalhas + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS;
    await db.usuario.update({
      where: { id: usuario.id },
      data: bloquear
        ? { tentativasFalhas: 0, bloqueadoAte: new Date(Date.now() + BLOQUEIO_MS) }
        : { tentativasFalhas: tentativas },
    });
    await registrarAuditoria(db, {
      usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN_FALHA",
      descricao: bloquear ? "Senha incorreta — conta bloqueada por 15 minutos" : "Senha incorreta", ip: meta.ip,
    });
    return { ok: false, motivo: bloquear ? "BLOQUEADO" : "CREDENCIAIS" };
  }

  await db.usuario.update({
    where: { id: usuario.id },
    data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLogin: new Date() },
  });
  const { token, expiraEm } = await criarSessao(db, usuario.id, meta);
  await registrarAuditoria(db, { usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN", ip: meta.ip });
  return { ok: true, token, expiraEm, trocarSenha: usuario.trocarSenha };
}

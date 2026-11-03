import type { Db } from "@/server/db";
import { registrarAuditoria } from "@/server/audit";
import { hashSenha, verificarSenha } from "./password";
import { criarSessao } from "./session";

export const MAX_TENTATIVAS = 5;
export const BLOQUEIO_MS = 15 * 60 * 1000;
/** Limite por IP (além do limite por conta): barra quem testa muitas contas a partir da mesma rede. */
export const MAX_FALHAS_IP = 20;
export const JANELA_IP_MS = 15 * 60 * 1000;

export type ResultadoLogin =
  | { ok: true; token: string; expiraEm: Date; trocarSenha: boolean }
  | { ok: false; motivo: "CREDENCIAIS" | "BLOQUEADO" | "BLOQUEADO_IP" };

let hashFalso: Promise<string> | undefined;

export async function autenticar(
  db: Db,
  emailBruto: string,
  senha: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<ResultadoLogin> {
  const email = emailBruto.trim().toLowerCase();
  if (meta.ip) {
    const falhas = await db.auditLog.count({
      where: { acao: "LOGIN_FALHA", ip: meta.ip, data: { gte: new Date(Date.now() - JANELA_IP_MS) } },
    });
    if (falhas >= MAX_FALHAS_IP) {
      await registrarAuditoria(db, { usuarioId: null, entidade: "usuario", acao: "LOGIN_FALHA", descricao: "Limite de tentativas por IP", ip: meta.ip });
      return { ok: false, motivo: "BLOQUEADO_IP" };
    }
  }
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

  // Relê a conta com trava de linha: se ela foi desativada durante a checagem da senha, não nasce sessão.
  const sessao = await db.$transaction(async (tx) => {
    const [atual] = await tx.$queryRaw<{ ativo: boolean; trocar_senha: boolean }[]>`
      SELECT ativo, trocar_senha FROM usuario WHERE id = ${usuario.id}::uuid FOR UPDATE`;
    if (!atual?.ativo) return null;
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLogin: new Date() },
    });
    const s = await criarSessao(tx, usuario.id, meta);
    await registrarAuditoria(tx, { usuarioId: usuario.id, entidade: "usuario", registroId: usuario.id, acao: "LOGIN", ip: meta.ip });
    return { ...s, trocarSenha: atual.trocar_senha };
  });
  if (!sessao) return { ok: false, motivo: "CREDENCIAIS" };
  return { ok: true, ...sessao };
}

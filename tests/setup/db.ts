import "dotenv/config";
import { PrismaClient, type Perfil } from "@prisma/client";
import { hashSenha } from "@/server/auth/password";

export const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });

export async function limparBanco() {
  await db.$executeRawUnsafe('TRUNCATE "audit_log", "sessao", "usuario" RESTART IDENTITY CASCADE');
}

let n = 0;
export async function criarUsuarioTeste(perfil: Perfil, extra: { senha?: string; ativo?: boolean; trocarSenha?: boolean } = {}) {
  n += 1;
  return db.usuario.create({
    data: {
      nome: `Usuário ${perfil} ${n}`,
      email: `${perfil.toLowerCase()}${n}@teste.local`,
      perfil,
      ativo: extra.ativo ?? true,
      trocarSenha: extra.trocarSenha ?? false,
      senhaHash: await hashSenha(extra.senha ?? "SenhaForte123"),
    },
  });
}

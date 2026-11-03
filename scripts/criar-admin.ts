// Cria (ou reativa) o primeiro Admin num banco novo, sem dados fictícios.
// Uso: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_NOME="..." ADMIN_SENHA=... npm run criar-admin
// A senha é provisória: o sistema obriga a troca no primeiro acesso.
import { PrismaClient } from "@prisma/client";
import { hashSenha, validarPoliticaSenha } from "../src/server/auth/password";

const REGIONAIS: [string, string][] = [
  ["BARREIRO", "Barreiro"], ["CENTRO_SUL", "Centro-Sul"], ["LESTE", "Leste"], ["NORDESTE", "Nordeste"], ["NOROESTE", "Noroeste"],
  ["NORTE", "Norte"], ["OESTE", "Oeste"], ["PAMPULHA", "Pampulha"], ["VENDA_NOVA", "Venda Nova"],
];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const nome = process.env.ADMIN_NOME?.trim();
  const senha = process.env.ADMIN_SENHA ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Defina ADMIN_EMAIL válido.");
  if (!nome) throw new Error("Defina ADMIN_NOME.");
  const erro = validarPoliticaSenha(senha);
  if (erro) throw new Error(erro);
  const db = new PrismaClient();
  try {
    for (const [codigo, n] of REGIONAIS) await db.regional.upsert({ where: { codigo }, update: {}, create: { codigo, nome: n } });
    const senhaHash = await hashSenha(senha);
    const u = await db.usuario.upsert({
      where: { email },
      update: { perfil: "ADMIN", ativo: true, senhaHash, trocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null },
      create: { email, nome, perfil: "ADMIN", senhaHash, trocarSenha: true },
    });
    await db.auditLog.create({ data: { usuarioId: u.id, acao: "CRIAR", entidade: "Usuario", registroId: u.id, valorNovo: { perfil: "ADMIN" }, descricao: "Admin criado pelo script criar-admin." } });
    console.log(`Admin pronto: ${email}. Troque a senha no primeiro acesso.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

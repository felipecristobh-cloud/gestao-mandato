import "dotenv/config";
import { PrismaClient, type Perfil } from "@prisma/client";
import { hashSenha } from "@/server/auth/password";

export const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });

export async function limparBanco() {
  await db.$executeRawUnsafe(
    'TRUNCATE "audit_log", "emenda_historico", "emenda_documento", "emenda_mandato", "emenda_lancamento", "emenda", "emenda_seq", "demanda_mandato", "mandato", "parlamentar", "sessao", "encaminhamento", "demanda_historico", "demanda", "pessoa", "protocolo_seq", "bairro", "tema", "orgao", "regional", "usuario" RESTART IDENTITY CASCADE',
  );
}

/** Cadastros base mínimos para os testes de demandas. */
export async function criarBase() {
  const regional = await db.regional.create({ data: { codigo: "LESTE", nome: "Leste" } });
  const outra = await db.regional.create({ data: { codigo: "OESTE", nome: "Oeste" } });
  const bairro = await db.bairro.create({ data: { nome: "Santa Tereza", regionalId: regional.id } });
  const bairroOeste = await db.bairro.create({ data: { nome: "Buritis", regionalId: outra.id } });
  const tema = await db.tema.create({ data: { nome: "Infraestrutura e obras" } });
  const temaInativo = await db.tema.create({ data: { nome: "Tema antigo", ativo: false } });
  const orgao = await db.orgao.create({ data: { nome: "Secretaria Municipal de Obras e Infraestrutura", sigla: "SMOBI" } });
  return { regional, outra, bairro, bairroOeste, tema, temaInativo, orgao };
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

import { PrismaClient, type Perfil } from "@prisma/client";
import { hashSenha } from "../src/server/auth/password";

const db = new PrismaClient();

const REGIONAIS = [
  ["BARREIRO", "Barreiro"], ["CENTRO_SUL", "Centro-Sul"], ["LESTE", "Leste"], ["NORDESTE", "Nordeste"],
  ["NOROESTE", "Noroeste"], ["NORTE", "Norte"], ["OESTE", "Oeste"], ["PAMPULHA", "Pampulha"], ["VENDA_NOVA", "Venda Nova"],
] as const;

// Somente pessoas fictícias. Nunca usar dados reais neste arquivo.
const USUARIOS: { nome: string; email: string; perfil: Perfil; cargo: string }[] = [
  { nome: "Ana Administradora", email: "admin@exemplo.local", perfil: "ADMIN", cargo: "Administração do sistema" },
  { nome: "Carlos Coordenador", email: "coordenacao@exemplo.local", perfil: "COORDENACAO", cargo: "Coordenação do gabinete" },
  { nome: "Beatriz Assessora", email: "assessor@exemplo.local", perfil: "ASSESSOR", cargo: "Assessora parlamentar" },
  { nome: "Diego Assessor", email: "assessor2@exemplo.local", perfil: "ASSESSOR", cargo: "Assessor parlamentar" },
  { nome: "Elisa Consulta", email: "consulta@exemplo.local", perfil: "CONSULTA", cargo: "Estagiária" },
];

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_SEED !== "1") {
    throw new Error("Seed bloqueado em produção (defina PERMITIR_SEED=1 só em homologação).");
  }
  for (const [codigo, nome] of REGIONAIS) {
    await db.regional.upsert({ where: { codigo }, update: { nome }, create: { codigo, nome } });
  }
  const senha = process.env.SEED_SENHA;
  if (!senha) throw new Error("Defina SEED_SENHA no .env");
  const senhaHash = await hashSenha(senha);
  for (const u of USUARIOS) {
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, senhaHash, trocarSenha: false },
    });
  }
  console.log(`Seed: ${REGIONAIS.length} regionais, ${USUARIOS.length} usuários fictícios.`);
}

main().finally(() => db.$disconnect());

// Garante os cadastros de referência (regionais, bairros, temas, órgãos). Uso: npx tsx scripts/cadastros-base.ts
import { PrismaClient } from "@prisma/client";
import { semearCadastrosBase } from "../prisma/cadastros-base";

const db = new PrismaClient();
semearCadastrosBase(db)
  .then((n) => console.log(`Cadastros base: ${n.regionais} regionais, ${n.bairros} bairros, ${n.temas} temas, ${n.orgaos} órgãos e ${n.eixos} eixos legislativos novos.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

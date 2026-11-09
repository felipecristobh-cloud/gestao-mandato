import type { Esfera, PrismaClient } from "@prisma/client";
import bairrosBH from "./dados/bairros-bh.json";

// Cadastros de referência (regionais, bairros, temas, órgãos e eixos legislativos). Idempotente: só cria o que falta e não
// altera registros existentes. Roda no build da Vercel e no seed.

export const REGIONAIS = [
  ["BARREIRO", "Barreiro"], ["CENTRO_SUL", "Centro-Sul"], ["LESTE", "Leste"], ["NORDESTE", "Nordeste"],
  ["NOROESTE", "Noroeste"], ["NORTE", "Norte"], ["OESTE", "Oeste"], ["PAMPULHA", "Pampulha"], ["VENDA_NOVA", "Venda Nova"],
] as const;

// Bairros de BH por regional, com o centro aproximado. Fonte: © colaboradores do OpenStreetMap (ODbL).
export const BAIRROS = bairrosBH as unknown as Record<string, [nome: string, latitude: number, longitude: number][]>;

export const TEMAS = [
  "Assistência social", "Cultura", "Educação", "Esporte e lazer", "Habitação", "Iluminação pública", "Infraestrutura e obras",
  "Limpeza urbana", "Meio ambiente", "Mobilidade e trânsito", "Saneamento", "Saúde", "Segurança", "Outros",
];

export const EIXOS_LEGISLATIVOS = [
  "Assistência social", "Saúde pública", "Educação", "Segurança alimentar", "Moradia e habitação", "Direitos humanos", "Mulheres",
  "Juventude", "População LGBTQIAPN+", "Igualdade racial", "População em situação de rua", "Trabalho e geração de renda",
  "Economia popular solidária", "Catadores e reciclagem", "Cultura", "Esporte e lazer", "Meio ambiente", "Mobilidade e acessibilidade",
  "Direitos da pessoa idosa", "Direitos das pessoas com deficiência", "Participação popular", "Outros",
];

export const ORGAOS: { nome: string; sigla: string; esfera: Esfera }[] = [
  { nome: "Secretaria Municipal de Obras e Infraestrutura", sigla: "SMOBI", esfera: "MUNICIPAL" },
  { nome: "Secretaria Municipal de Saúde", sigla: "SMSA", esfera: "MUNICIPAL" },
  { nome: "Secretaria Municipal de Educação", sigla: "SMED", esfera: "MUNICIPAL" },
  { nome: "Secretaria Municipal de Assistência Social", sigla: "SMASAC", esfera: "MUNICIPAL" },
  { nome: "Secretaria Municipal de Meio Ambiente", sigla: "SMMA", esfera: "MUNICIPAL" },
  { nome: "Superintendência de Limpeza Urbana", sigla: "SLU", esfera: "MUNICIPAL" },
  { nome: "BHTrans", sigla: "BHTRANS", esfera: "MUNICIPAL" },
  { nome: "Companhia Urbanizadora e de Habitação de Belo Horizonte", sigla: "URBEL", esfera: "MUNICIPAL" },
  { nome: "Defesa Civil Municipal", sigla: "DEFESA CIVIL", esfera: "MUNICIPAL" },
  { nome: "Guarda Civil Municipal", sigla: "GCM", esfera: "MUNICIPAL" },
  { nome: "Companhia de Saneamento de Minas Gerais", sigla: "COPASA", esfera: "ESTADUAL" },
  { nome: "Companhia Energética de Minas Gerais", sigla: "CEMIG", esfera: "ESTADUAL" },
  { nome: "Polícia Militar de Minas Gerais", sigla: "PMMG", esfera: "ESTADUAL" },
];

export async function semearCadastrosBase(db: PrismaClient) {
  const regionais = await db.regional.createMany({
    data: REGIONAIS.map(([codigo, nome]) => ({ codigo, nome })),
    skipDuplicates: true,
  });
  const idRegional = new Map((await db.regional.findMany({ select: { id: true, codigo: true } })).map((r) => [r.codigo, r.id]));
  const bairros = await db.bairro.createMany({
    data: Object.entries(BAIRROS).flatMap(([codigo, lista]) =>
      lista.map(([nome, latitude, longitude]) => ({ nome, latitude, longitude, regionalId: idRegional.get(codigo)! })),
    ),
    skipDuplicates: true,
  });
  const temas = await db.tema.createMany({ data: TEMAS.map((nome) => ({ nome })), skipDuplicates: true });
  const orgaos = await db.orgao.createMany({ data: ORGAOS, skipDuplicates: true });
  const eixos = await db.eixoLegislativo.createMany({ data: EIXOS_LEGISLATIVOS.map((nome) => ({ nome })), skipDuplicates: true });
  return { regionais: regionais.count, bairros: bairros.count, temas: temas.count, orgaos: orgaos.count, eixos: eixos.count };
}

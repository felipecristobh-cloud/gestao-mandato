import { PrismaClient, type Esfera, type Perfil, type Prioridade, type StatusDemanda, type TipoDemanda, type TipoHistorico } from "@prisma/client";
import { hashSenha } from "../src/server/auth/password";
import { deISO, hojeISO, somarDias } from "../src/lib/demandas";

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

const BAIRROS: Record<string, string[]> = {
  BARREIRO: ["Barreiro", "Milionários", "Lindéia"],
  CENTRO_SUL: ["Centro", "Savassi", "Serra"],
  LESTE: ["Santa Tereza", "Floresta", "Sagrada Família"],
  NORDESTE: ["Cidade Nova", "São Paulo", "Ipiranga"],
  NOROESTE: ["Padre Eustáquio", "Carlos Prates", "Caiçara"],
  NORTE: ["Primeiro de Maio", "Tupi", "Jaqueline"],
  OESTE: ["Buritis", "Gameleira", "Salgado Filho"],
  PAMPULHA: ["Ouro Preto", "Santa Amélia", "Castelo"],
  VENDA_NOVA: ["Venda Nova", "Mantiqueira", "Céu Azul"],
};

const TEMAS = [
  "Assistência social", "Cultura", "Educação", "Esporte e lazer", "Habitação", "Iluminação pública", "Infraestrutura e obras",
  "Limpeza urbana", "Meio ambiente", "Mobilidade e trânsito", "Saneamento", "Saúde", "Segurança", "Outros",
];

const ORGAOS: { nome: string; sigla: string; esfera: Esfera }[] = [
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

// [nome fictício, bairro, tema, tipo, prioridade, status, prazo (dias a partir de hoje), responsável (e-mail), órgão, descrição]
const DEMANDAS: [string, string, string, TipoDemanda, Prioridade, StatusDemanda, number | null, string | null, string | null, string][] = [
  ["Maria Exemplo da Silva", "Santa Tereza", "Infraestrutura e obras", "RECLAMACAO", "ALTA", "ENCAMINHADA", -5, "assessor", "SMOBI", "Buraco grande na Rua Fictícia A, perto da escola. Carros desviando pela calçada."],
  ["Maria Exemplo da Silva", "Santa Tereza", "Iluminação pública", "SOLICITACAO", "MEDIA", "NOVA", 10, null, null, "Três postes apagados na praça do bairro há duas semanas."],
  ["João Teste Pereira", "Venda Nova", "Saúde", "SOLICITACAO", "URGENTE", "AGUARDANDO_RETORNO", -12, "assessor2", "SMSA", "Pedido de agilidade em consulta com especialista (cardiologia) no centro de saúde."],
  ["Ana Fictícia Souza", "Barreiro", "Educação", "SOLICITACAO", "ALTA", "EM_ANALISE", 3, "assessor", null, "Vaga em EMEI para criança de 3 anos; família na lista de espera desde março."],
  ["Pedro Modelo Santos", "Buritis", "Mobilidade e trânsito", "SUGESTAO", "MEDIA", "ENCAMINHADA", 20, "coordenacao", "BHTRANS", "Faixa de pedestre e redutor de velocidade na avenida em frente ao supermercado."],
  ["Lúcia Amostra Lima", "Cidade Nova", "Limpeza urbana", "RECLAMACAO", "BAIXA", "RESOLVIDA", -20, "assessor2", "SLU", "Lote vago com acúmulo de lixo e entulho."],
  ["Rafael Exemplo Costa", "Padre Eustáquio", "Saneamento", "RECLAMACAO", "ALTA", "EM_ANDAMENTO", 0, "assessor", "COPASA", "Vazamento de esgoto na rua há mais de um mês."],
  ["Sônia Teste Rocha", "Primeiro de Maio", "Assistência social", "SOLICITACAO", "ALTA", "NOVA", null, null, null, "Família em situação de vulnerabilidade pede orientação sobre CadÚnico e cesta básica."],
  ["Carla Fictícia Mendes", "Ouro Preto", "Meio ambiente", "SOLICITACAO", "MEDIA", "ENCAMINHADA", 6, "assessor2", "SMMA", "Poda de árvore com galhos encostando na rede elétrica."],
  ["Bruno Modelo Alves", "Serra", "Habitação", "PEDIDO_INFORMACAO", "MEDIA", "EM_ANALISE", 14, "coordenacao", null, "Informação sobre andamento de programa habitacional para a vila."],
  ["Fernanda Teste Dias", "Castelo", "Esporte e lazer", "SUGESTAO", "BAIXA", "NOVA", 28, null, null, "Reforma da quadra poliesportiva da praça."],
  ["Gustavo Exemplo Nunes", "Floresta", "Segurança", "DENUNCIA", "URGENTE", "AGUARDANDO_RETORNO", -2, "assessor", "GCM", "Pontos de pouca iluminação e relatos de assaltos perto do ponto de ônibus."],
  ["Helena Amostra Ramos", "Mantiqueira", "Infraestrutura e obras", "SOLICITACAO", "ALTA", "EM_ANDAMENTO", 40, "assessor2", "SMOBI", "Muro de contenção com rachaduras após as chuvas."],
  ["Igor Fictício Barbosa", "Caiçara", "Cultura", "SOLICITACAO", "BAIXA", "CANCELADA", null, "assessor", null, "Apoio para evento cultural do bairro (cancelado pelo solicitante)."],
  ["Juliana Teste Freitas", "Céu Azul", "Saúde", "RECLAMACAO", "ALTA", "NAO_RESOLVIDA", -15, "coordenacao", "SMSA", "Falta de medicamento de uso contínuo na farmácia do centro de saúde."],
  ["Marcos Modelo Teixeira", "Gameleira", "Mobilidade e trânsito", "RECLAMACAO", "MEDIA", "NOVA", 5, "assessor2", null, "Ônibus da linha do bairro atrasando com frequência no horário de pico."],
  ["Natália Exemplo Pinto", "Savassi", "Limpeza urbana", "SOLICITACAO", "BAIXA", "NOVA", null, null, null, "Instalação de lixeiras na praça."],
  ["Otávio Teste Moreira", "Jaqueline", "Infraestrutura e obras", "SOLICITACAO", "URGENTE", "EM_ANALISE", -1, "assessor", null, "Boca de lobo entupida, alagamento em dias de chuva."],
  ["Paula Fictícia Araújo", "Lindéia", "Educação", "PEDIDO_INFORMACAO", "MEDIA", "RESOLVIDA", -8, "assessor", "SMED", "Informação sobre transporte escolar para aluno com deficiência."],
  ["Roberto Amostra Cardoso", "Sagrada Família", "Saneamento", "RECLAMACAO", "MEDIA", "ENCAMINHADA", 12, "coordenacao", "COPASA", "Falta de água recorrente nos fins de semana."],
];

async function seedDemandas(usuarios: Map<string, string>) {
  const regionais = await db.regional.findMany();
  for (const r of regionais) {
    for (const nome of BAIRROS[r.codigo] ?? []) {
      await db.bairro.upsert({ where: { nome_regionalId: { nome, regionalId: r.id } }, update: {}, create: { nome, regionalId: r.id } });
    }
  }
  for (const nome of TEMAS) await db.tema.upsert({ where: { nome }, update: {}, create: { nome } });
  for (const o of ORGAOS) await db.orgao.upsert({ where: { nome: o.nome }, update: {}, create: o });

  if ((await db.demanda.count()) > 0) return 0;
  const bairros = new Map((await db.bairro.findMany()).map((b) => [b.nome, b.id]));
  const temas = new Map((await db.tema.findMany()).map((t) => [t.nome, t.id]));
  const orgaos = new Map((await db.orgao.findMany()).map((o) => [o.sigla ?? o.nome, o.id]));
  const hoje = hojeISO();
  const ano = Number(hoje.slice(0, 4));
  const pessoas = new Map<string, string>();
  const criadores = ["assessor", "assessor2", "coordenacao"];

  let i = 0;
  for (const [nome, bairro, tema, tipo, prioridade, status, prazo, resp, orgao, descricao] of DEMANDAS) {
    i++;
    const autor = usuarios.get(criadores[i % 3])!;
    const responsavelId = resp ? usuarios.get(resp)! : null;
    const bairroId = bairros.get(bairro)!;
    let pessoaId = pessoas.get(nome);
    if (!pessoaId) {
      const tel = `(31) 90000-${String(1000 + i).slice(-4)}`;
      const email = `${nome.split(" ")[0].normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase()}${i}@exemplo.local`;
      pessoaId = (await db.pessoa.create({ data: { nome, telefone: tel, email, endereco: `Rua Fictícia ${i}, ${i * 10}`, bairroId, criadoPorId: autor } })).id;
      pessoas.set(nome, pessoaId);
    }
    const entrada = somarDias(hoje, -(30 - i));
    const finalizada = ["RESOLVIDA", "NAO_RESOLVIDA", "CANCELADA"].includes(status);
    const d = await db.demanda.create({
      data: {
        protocolo: `DEM-${ano}-${String(i).padStart(5, "0")}`,
        pessoaId, endereco: `Rua Fictícia ${i}, ${i * 10}`, bairroId, temaId: temas.get(tema)!, tipo, descricao, prioridade, status,
        prazo: prazo === null ? null : deISO(somarDias(hoje, prazo)),
        responsavelId, orgaoId: orgao ? orgaos.get(orgao)! : null,
        dataEntrada: deISO(entrada), dataConclusao: finalizada ? deISO(somarDias(hoje, -1)) : null, criadoPorId: autor,
        criadoEm: new Date(`${entrada}T13:00:00Z`),
      },
    });
    const h: { tipo: TipoHistorico; descricao: string; statusAnterior?: StatusDemanda; statusNovo?: StatusDemanda; usuarioId: string; data: Date }[] = [
      { tipo: "CRIACAO", descricao: 'Demanda cadastrada como "Nova".', statusNovo: "NOVA", usuarioId: autor, data: d.criadoEm },
    ];
    if (orgao) {
      const e = await db.encaminhamento.create({
        data: {
          demandaId: d.id, orgaoId: orgaos.get(orgao)!, usuarioId: responsavelId ?? autor, data: deISO(somarDias(entrada, 2)),
          protocolo: `OF-${100 + i}/${ano}`, descricao: "Ofício encaminhado solicitando providências.",
          prazoRetorno: deISO(somarDias(entrada, 17)),
          ...(finalizada || status === "EM_ANDAMENTO" ? { retorno: "Órgão informou que a solicitação foi analisada.", dataRetorno: deISO(somarDias(entrada, 10)) } : {}),
        },
      });
      h.push({ tipo: "ENCAMINHAMENTO", descricao: `Encaminhada para ${orgao} (protocolo ${e.protocolo}): ${e.descricao}`, statusAnterior: "NOVA", statusNovo: "ENCAMINHADA", usuarioId: responsavelId ?? autor, data: new Date(`${somarDias(entrada, 2)}T14:00:00Z`) });
    }
    if (status !== "NOVA" && status !== "ENCAMINHADA") {
      const anterior: StatusDemanda = orgao ? "ENCAMINHADA" : "NOVA";
      h.push({ tipo: "STATUS", descricao: `Status alterado para ${status.replace(/_/g, " ").toLowerCase()}.`, statusAnterior: anterior, statusNovo: status, usuarioId: responsavelId ?? autor, data: new Date(`${somarDias(entrada, 11)}T15:00:00Z`) });
    }
    await db.demandaHistorico.createMany({ data: h.map((x) => ({ ...x, demandaId: d.id })) });
  }
  await db.protocoloSeq.upsert({ where: { ano }, update: { ultimo: DEMANDAS.length }, create: { ano, ultimo: DEMANDAS.length } });
  return DEMANDAS.length;
}

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
      create: { ...u, senhaHash, trocarSenha: true },
    });
  }
  const ids = new Map((await db.usuario.findMany({ select: { id: true, email: true } })).map((u) => [u.email.split("@")[0], u.id]));
  const demandas = await seedDemandas(ids);
  console.log(`Seed: ${REGIONAIS.length} regionais, ${USUARIOS.length} usuários fictícios, ${demandas} demandas fictícias novas.`);
}

main().finally(() => db.$disconnect());

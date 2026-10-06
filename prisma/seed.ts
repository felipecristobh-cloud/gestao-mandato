import { PrismaClient, type Esfera, type Perfil, type Prioridade, type StatusDemanda, type TipoDemanda, type TipoHistorico } from "@prisma/client";
import { hashSenha } from "../src/server/auth/password";
import { deISO, hojeISO, somarDias } from "../src/lib/demandas";
import { completarCnpj, decimalDe } from "../src/lib/emendas";

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

const PARLAMENTARES = [
  // Titular do gabinete (agente político público). Confirme partido e datas no sistema.
  { nome: "Pedro Patrus", cargo: "VEREADOR", partido: "PT", municipio: "Belo Horizonte", uf: "MG", proprio: true,
    mandatos: [["2025–2028", "2025-01-01", "2028-12-31"]] },
  // Parceiros fictícios.
  { nome: "Deputada Estadual Exemplo Alfa", cargo: "DEPUTADO_ESTADUAL", partido: "PFA", municipio: "Belo Horizonte", uf: "MG", proprio: false,
    mandatos: [["19ª legislatura", "2019-02-01", "2023-01-31"], ["20ª legislatura", "2023-02-01", "2027-01-31"]] },
  { nome: "Deputado Federal Exemplo Beta", cargo: "DEPUTADO_FEDERAL", partido: "PFB", municipio: null, uf: "MG", proprio: false,
    mandatos: [["57ª legislatura", "2023-02-01", "2027-01-31"]] },
  { nome: "Deputada Federal Exemplo Gama", cargo: "DEPUTADO_FEDERAL", partido: "PFA", municipio: null, uf: "MG", proprio: false,
    mandatos: [["57ª legislatura", "2023-02-01", "2027-01-31"]] },
  { nome: "Senador Exemplo Delta", cargo: "SENADOR", partido: "PFC", municipio: null, uf: "MG", proprio: false,
    mandatos: [["2019–2027", "2019-02-01", "2027-01-31"]] },
  { nome: "Vereadora Exemplo Épsilon", cargo: "VEREADOR", partido: "PFB", municipio: "Belo Horizonte", uf: "MG", proprio: false,
    mandatos: [["2021–2024", "2021-01-01", "2024-12-31"], ["2025–2028", "2025-01-01", "2028-12-31"]] },
  { nome: "Ex-Vereador Exemplo Zeta", cargo: "VEREADOR", partido: "PFC", municipio: "Belo Horizonte", uf: "MG", proprio: false, ativo: false,
    mandatos: [["2017–2020", "2017-01-01", "2020-12-31"]] },
] as const;

async function seedParlamentares(usuarios: Map<string, string>) {
  if ((await db.parlamentar.count()) > 0) return 0;
  const autor = usuarios.get("coordenacao")!;
  const vigentes: string[] = [];
  for (const { mandatos, ...p } of PARLAMENTARES) {
    const esfera = p.cargo === "VEREADOR" ? "MUNICIPAL" : p.cargo === "DEPUTADO_ESTADUAL" ? "ESTADUAL" : "FEDERAL";
    const criado = await db.parlamentar.create({ data: { ...p, esfera, criadoPorId: autor } });
    for (const [legislatura, inicio, fim] of mandatos) {
      const m = await db.mandato.create({
        data: { parlamentarId: criado.id, cargo: p.cargo, esfera, legislatura, partido: p.partido, municipio: p.municipio, uf: p.uf,
          dataInicio: deISO(inicio), dataFim: deISO(fim), criadoPorId: autor },
      });
      if (!p.proprio && fim >= hojeISO() && inicio <= hojeISO()) vigentes.push(m.id);
    }
  }
  const demandas = await db.demanda.findMany({ orderBy: { protocolo: "asc" }, take: 4, select: { id: true } });
  const tipos = ["ARTICULADOR", "PARCEIRO", "ACOMPANHAMENTO", "INTERMEDIARIO"] as const;
  for (const [i, d] of demandas.entries()) {
    const mandatoId = vigentes[i % vigentes.length];
    const m = await db.mandato.findUniqueOrThrow({ where: { id: mandatoId }, include: { parlamentar: true } });
    await db.demandaMandato.create({ data: { demandaId: d.id, mandatoId, tipo: tipos[i], usuarioId: autor } });
    await db.demandaHistorico.create({ data: { demandaId: d.id, usuarioId: autor, tipo: "ARTICULACAO", descricao: `Vínculo com ${m.parlamentar.nome} (${tipos[i].toLowerCase()}).` } });
  }
  return PARLAMENTARES.length;
}


type LancSeed = readonly [tipo: "EMPENHO" | "LIQUIDACAO" | "PAGAMENTO", reais: number, data: string];
type VincSeed = readonly [parlamentar: string, tipo: "AUTOR" | "COAUTOR" | "ARTICULADOR" | "PARCEIRO" | "ACOMPANHAMENTO" | "EXECUCAO" | "INTERMEDIARIO", responsabilidade?: string];

// Emendas fictícias: números, beneficiários e CNPJs inventados.
const EMENDAS: {
  esfera: Esfera; numero: string | null; ano: number; tipo: "INDIVIDUAL" | "BANCADA" | "COMISSAO"; objeto: string; beneficiario: string; cnpj12: string;
  indicado: number; aprovado: number | null; status: string; programa?: string; lanc: LancSeed[]; vinc: VincSeed[]; resp: string; bairro?: boolean;
}[] = [
  { esfera: "MUNICIPAL", numero: "101", ano: 2025, tipo: "INDIVIDUAL", objeto: "Reforma da quadra poliesportiva do centro comunitário fictício", beneficiario: "Associação Comunitária Exemplo Um",
    cnpj12: "112223330001", indicado: 150000, aprovado: 150000, status: "PAGA", programa: "Esporte e lazer",
    lanc: [["EMPENHO", 150000, "2025-04-10"], ["LIQUIDACAO", 150000, "2025-08-20"], ["PAGAMENTO", 150000, "2025-09-05"]],
    vinc: [["Pedro Patrus", "AUTOR"]], resp: "assessor", bairro: true },
  { esfera: "MUNICIPAL", numero: "102", ano: 2025, tipo: "INDIVIDUAL", objeto: "Aquisição de equipamentos para centro de saúde fictício", beneficiario: "Fundo Municipal de Saúde (exemplo)",
    cnpj12: "223334440001", indicado: 200000, aprovado: 180000, status: "EM_EXECUCAO", programa: "Atenção básica",
    lanc: [["EMPENHO", 180000, "2025-05-12"], ["LIQUIDACAO", 90000, "2025-11-03"], ["PAGAMENTO", 60000, "2025-12-10"]],
    vinc: [["Pedro Patrus", "AUTOR"], ["Pedro Patrus", "ACOMPANHAMENTO", "Acompanhar entregas na regional"]], resp: "assessor", bairro: true },
  { esfera: "MUNICIPAL", numero: "205", ano: 2026, tipo: "INDIVIDUAL", objeto: "Iluminação e paisagismo de praça fictícia", beneficiario: "Secretaria de Obras (exemplo)",
    cnpj12: "334445550001", indicado: 120000, aprovado: null, status: "PROTOCOLADA", lanc: [], vinc: [["Pedro Patrus", "AUTOR"]], resp: "assessor2", bairro: true },
  { esfera: "MUNICIPAL", numero: "207", ano: 2026, tipo: "INDIVIDUAL", objeto: "Oficinas culturais para juventude em espaço fictício", beneficiario: "Coletivo Cultural Exemplo",
    cnpj12: "445556660001", indicado: 80000, aprovado: 80000, status: "IMPEDIMENTO_TECNICO", lanc: [],
    vinc: [["Vereadora Exemplo Épsilon", "AUTOR"], ["Pedro Patrus", "COAUTOR"]], resp: "assessor2", bairro: true },
  { esfera: "ESTADUAL", numero: "3150", ano: 2025, tipo: "INDIVIDUAL", objeto: "Custeio de entidade fictícia de assistência a idosos", beneficiario: "Lar Exemplo de Idosos",
    cnpj12: "556667770001", indicado: 300000, aprovado: 300000, status: "LIQUIDADA",
    lanc: [["EMPENHO", 300000, "2025-06-02"], ["LIQUIDACAO", 300000, "2025-10-15"]],
    vinc: [["Deputada Estadual Exemplo Alfa", "AUTOR"], ["Pedro Patrus", "ARTICULADOR", "Articulou a indicação com a entidade"]], resp: "coordenacao" },
  { esfera: "ESTADUAL", numero: "4410", ano: 2026, tipo: "INDIVIDUAL", objeto: "Equipamentos para escola estadual fictícia", beneficiario: "Caixa Escolar Exemplo",
    cnpj12: "667778880001", indicado: 250000, aprovado: 250000, status: "EMPENHADA", lanc: [["EMPENHO", 250000, "2026-05-20"]],
    vinc: [["Deputada Estadual Exemplo Alfa", "AUTOR"], ["Pedro Patrus", "ACOMPANHAMENTO", "Acompanhar plano de trabalho"]], resp: "assessor" },
  { esfera: "ESTADUAL", numero: null, ano: 2026, tipo: "INDIVIDUAL", objeto: "Reforma de unidade de acolhimento fictícia", beneficiario: "Associação Exemplo de Acolhimento",
    cnpj12: "778889990001", indicado: 400000, aprovado: null, status: "EM_NEGOCIACAO", lanc: [],
    vinc: [["Deputada Estadual Exemplo Alfa", "PARCEIRO"], ["Pedro Patrus", "ARTICULADOR"]], resp: "coordenacao" },
  { esfera: "FEDERAL", numero: "2025.0001", ano: 2025, tipo: "INDIVIDUAL", objeto: "Aquisição de ambulância para serviço fictício", beneficiario: "Fundo Municipal de Saúde (exemplo)",
    cnpj12: "889990010001", indicado: 350000, aprovado: 350000, status: "CONCLUIDA",
    lanc: [["EMPENHO", 350000, "2025-03-15"], ["LIQUIDACAO", 350000, "2025-07-01"], ["PAGAMENTO", 350000, "2025-07-20"]],
    vinc: [["Deputado Federal Exemplo Beta", "AUTOR"], ["Pedro Patrus", "INTERMEDIARIO", "Intermediou a demanda da regional"]], resp: "coordenacao" },
  { esfera: "FEDERAL", numero: "2026.0042", ano: 2026, tipo: "BANCADA", objeto: "Pavimentação de vias em vila fictícia", beneficiario: "Prefeitura (exemplo)",
    cnpj12: "990001120001", indicado: 1000000, aprovado: 800000, status: "EM_ANALISE", lanc: [],
    vinc: [["Deputada Federal Exemplo Gama", "AUTOR"], ["Senador Exemplo Delta", "COAUTOR"], ["Pedro Patrus", "ACOMPANHAMENTO"], ["Pedro Patrus", "ARTICULADOR"]], resp: "assessor" },
  { esfera: "FEDERAL", numero: "2026.0077", ano: 2026, tipo: "INDIVIDUAL", objeto: "Programa fictício de qualificação profissional", beneficiario: "Instituto Exemplo de Formação",
    cnpj12: "101112130001", indicado: 500000, aprovado: null, status: "CANCELADA", lanc: [],
    vinc: [["Senador Exemplo Delta", "AUTOR"], ["Pedro Patrus", "PARCEIRO"]], resp: "coordenacao" },
];

async function seedEmendas(usuarios: Map<string, string>) {
  if ((await db.emenda.count()) > 0) return 0;
  const autor = usuarios.get("coordenacao")!;
  const mandatos = await db.mandato.findMany({ include: { parlamentar: { select: { nome: true } } } });
  const mandatoDe = (nome: string, ano: number) => {
    const m = mandatos.find((x) => x.parlamentar.nome === nome && x.dataInicio.getUTCFullYear() <= ano && (x.dataFim?.getUTCFullYear() ?? 9999) >= ano);
    if (!m) throw new Error(`Seed: mandato de ${nome} em ${ano} não encontrado.`);
    return m.id;
  };
  const orgaos = await db.orgao.findMany({ orderBy: { id: "asc" }, select: { id: true } });
  const bairros = await db.bairro.findMany({ orderBy: { id: "asc" }, take: 10, select: { id: true } });
  const anoCodigo = Number(hojeISO().slice(0, 4));
  for (const [i, e] of EMENDAS.entries()) {
    const soma = (t: string) => e.lanc.filter((l) => l[0] === t).reduce((s, l) => s + l[1] * 100, 0);
    const criada = await db.emenda.create({
      data: {
        codigo: `EME-${anoCodigo}-${String(i + 1).padStart(5, "0")}`, numero: e.numero, ano: e.ano, esfera: e.esfera, tipo: e.tipo,
        objeto: e.objeto, justificativa: "Justificativa fictícia para demonstração do sistema.", beneficiario: e.beneficiario, cnpj: completarCnpj(e.cnpj12),
        valorIndicado: decimalDe(e.indicado * 100), valorAprovado: e.aprovado === null ? null : decimalDe(e.aprovado * 100),
        valorEmpenhado: decimalDe(soma("EMPENHO")), valorLiquidado: decimalDe(soma("LIQUIDACAO")), valorPago: decimalDe(soma("PAGAMENTO")),
        status: e.status as never, municipio: "Belo Horizonte", orgaoId: orgaos.length ? orgaos[i % orgaos.length].id : null,
        bairroId: e.bairro && bairros.length ? bairros[i % bairros.length].id : null, programa: e.programa ?? null,
        prazo: deISO(somarDias(hojeISO(), 15 + i * 20)), responsavelId: usuarios.get(e.resp) ?? null, criadoPorId: autor,
      },
    });
    await db.emendaHistorico.create({ data: { emendaId: criada.id, usuarioId: autor, tipo: "CRIACAO", statusNovo: criada.status, descricao: "Emenda fictícia cadastrada pelo seed." } });
    if (e.status === "IMPEDIMENTO_TECNICO" || e.status === "CANCELADA") {
      await db.emendaHistorico.create({ data: { emendaId: criada.id, usuarioId: autor, tipo: "STATUS", statusNovo: criada.status, descricao: "Motivo fictício: documentação do beneficiário incompleta." } });
    }
    for (const [tipo, reais, data] of e.lanc) {
      await db.emendaLancamento.create({ data: { emendaId: criada.id, tipo, valor: decimalDe(reais * 100), data: deISO(data), documento: `${tipo.slice(0, 2)}-${i + 1}`, usuarioId: autor } });
    }
    for (const [nome, tipo, responsabilidade] of e.vinc) {
      await db.emendaMandato.create({ data: { emendaId: criada.id, mandatoId: mandatoDe(nome, e.ano), tipo, responsabilidade: responsabilidade ?? null, usuarioId: autor } });
    }
  }
  await db.emendaSeq.upsert({ where: { ano: anoCodigo }, update: { ultimo: EMENDAS.length }, create: { ano: anoCodigo, ultimo: EMENDAS.length } });
  return EMENDAS.length;
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
  const parlamentares = await seedParlamentares(ids);
  const emendas = await seedEmendas(ids);
  console.log(`Seed: ${REGIONAIS.length} regionais, ${USUARIOS.length} usuários fictícios, ${demandas} demandas fictícias novas, ${parlamentares} parlamentares novos, ${emendas} emendas novas.`);
}

main().finally(() => db.$disconnect());

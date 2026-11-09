import ExcelJS from "exceljs";
import { semAcento } from "@/lib/proposicoes";
import { validacao } from "@/server/errors";

export const MAX_LINHAS = 2000;
export const MAX_BYTES = 2 * 1024 * 1024;

/** Coluna da planilha → campo. Aceita variações com/sem acento, maiúsculas etc. */
const COLUNAS: Record<string, string> = {
  tipo: "tipo", "tipo de proposicao": "tipo", "tipo proposicao": "tipo", sigla: "tipo",
  numero: "numero", n: "numero", no: "numero", "numero da proposicao": "numero",
  ano: "ano",
  ementa: "ementa",
  descricao: "descricao", "descricao completa": "descricao",
  justificativa: "justificativa", "justificativa original": "justificativa",
  autoria: "participacao", participacao: "participacao", "autoria participacao": "participacao", "tipo de autoria": "participacao",
  parlamentares: "parlamentares", "demais parlamentares": "parlamentares", "parlamentares envolvidos": "parlamentares", coautores: "parlamentares",
  "data de apresentacao": "dataApresentacao", "data apresentacao": "dataApresentacao", apresentacao: "dataApresentacao",
  comissoes: "comissoes",
  pareceres: "pareceres", parecer: "pareceres",
  situacao: "situacao", "situacao atual": "situacao",
  "resultado das votacoes": "resultadoVotacao", "resultado votacao": "resultadoVotacao", votacao: "resultadoVotacao", resultado: "resultadoVotacao",
  lei: "lei", "lei correspondente": "lei",
  "data de aprovacao ou arquivamento": "dataConclusao", "data de conclusao": "dataConclusao", "data conclusao": "dataConclusao",
  "data de aprovacao": "dataConclusao", "data de arquivamento": "dataConclusao",
  link: "linkOficial", "link oficial": "linkOficial", url: "linkOficial", "link cmbh": "linkOficial",
  observacoes: "observacoes", "observacoes internas": "observacoes", obs: "observacoes",
  fonte: "fonte", "fonte da informacao": "fonte",
  verificacao: "verificacao", "estado de verificacao": "verificacao", status: "verificacao",
  eixo: "eixo", tema: "eixo", "eixo tematico": "eixo",
};

export const CAMPOS_PLANILHA = [
  "tipo", "numero", "ano", "ementa", "participacao", "fonte", "verificacao", "eixo", "dataApresentacao", "situacao", "linkOficial", "descricao",
  "justificativa", "parlamentares", "comissoes", "pareceres", "resultadoVotacao", "lei", "dataConclusao", "observacoes",
] as const;
export type CampoPlanilha = (typeof CAMPOS_PLANILHA)[number];
export type Linha = Partial<Record<CampoPlanilha, string>>;

/** Divide CSV respeitando aspas. Detecta ; , ou tab pelo cabeçalho. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const cab = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].map((s) => [s, cab.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

function textoCelula(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("hyperlink" in v && v.hyperlink) return String(v.hyperlink);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return textoCelula(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

async function lerXlsx(dados: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(dados as unknown as ArrayBuffer);
  } catch {
    throw validacao("Não consegui ler a planilha. Salve como .xlsx ou .csv e tente de novo.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw validacao("A planilha está vazia.");
  const linhas: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const valores: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) valores.push(textoCelula(row.getCell(c).value));
    linhas.push(valores);
  });
  return linhas;
}

/** Lê CSV ou XLSX e devolve as linhas já com os nomes de campo do sistema. */
export async function lerPlanilha(nome: string, dados: Buffer): Promise<{ linhas: Linha[]; ignoradas: string[] }> {
  if (dados.length === 0) throw validacao("O arquivo está vazio.");
  if (dados.length > MAX_BYTES) throw validacao("Arquivo maior que 2 MB. Divida a planilha em partes.");
  const ext = nome.toLowerCase().split(".").pop();
  let bruto: string[][];
  if (ext === "csv" || ext === "txt") bruto = lerCsv(dados.toString("utf8"));
  else if (ext === "xlsx") {
    if (dados[0] !== 0x50 || dados[1] !== 0x4b) throw validacao("O arquivo não é um .xlsx válido.");
    bruto = await lerXlsx(dados);
  } else throw validacao("Envie um arquivo .xlsx ou .csv.");
  const [cab, ...resto] = bruto.filter((l) => l.some((c) => c.trim()));
  if (!cab) throw validacao("A planilha está vazia.");
  const campos = cab.map((c) => COLUNAS[semAcento(c)] ?? null);
  if (!campos.includes("tipo") || !campos.includes("numero") || !campos.includes("ano")) {
    throw validacao("A primeira linha precisa ter os nomes das colunas, com pelo menos Tipo, Número e Ano. Use o modelo.");
  }
  if (resto.length > MAX_LINHAS) throw validacao(`A planilha tem ${resto.length} linhas; o limite é ${MAX_LINHAS} por importação.`);
  const ignoradas = cab.filter((_, i) => !campos[i]).map((c) => c.trim()).filter(Boolean);
  const linhas = resto.map((l) => {
    const r: Linha = {};
    campos.forEach((campo, i) => { if (campo && l[i]?.trim()) r[campo as CampoPlanilha] = l[i].trim(); });
    return r;
  });
  return { linhas, ignoradas };
}

export const CABECALHO_MODELO = [
  "Tipo", "Número", "Ano", "Ementa", "Autoria", "Fonte", "Verificação", "Eixo", "Data de apresentação", "Situação", "Link oficial", "Descrição",
  "Justificativa", "Parlamentares", "Comissões", "Pareceres", "Resultado das votações", "Lei correspondente", "Data de aprovação ou arquivamento",
  "Observações",
];

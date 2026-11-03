import ExcelJS from "exceljs";
import { totais, type Coluna, type Relatorio } from "@/lib/relatorios";

const COR = "FFA51D1D";
const FMT: Partial<Record<Coluna["tipo"], string>> = {
  moeda: '"R$" #,##0.00',
  percentual: "0.0%",
  data: "dd/mm/yyyy",
  inteiro: "0",
};
const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Planilha com cabeçalho, filtros e totais/percentuais como fórmulas (recalculam se a planilha for editada). */
export async function gerarExcel(r: Relatorio): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestão do Mandato";
  wb.created = r.geradoEm;
  const ws = wb.addWorksheet(r.titulo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const n = r.colunas.length;
  const letra = (i: number) => ws.getColumn(i + 1).letter;
  const idx = new Map(r.colunas.map((c, i) => [c.chave, i]));

  const cab = (texto: string, estilo: Partial<ExcelJS.Font>) => {
    const row = ws.addRow([texto]);
    ws.mergeCells(row.number, 1, row.number, n);
    row.getCell(1).font = estilo;
  };
  cab("MANDATO PEDRO PATRUS — GESTÃO DO MANDATO", { bold: true, size: 9, color: { argb: COR } });
  cab(r.titulo.toUpperCase(), { bold: true, size: 14 });
  cab(`Gerado em ${dataHora.format(r.geradoEm)} por ${r.geradoPor}`, { size: 9, color: { argb: "FF64748B" } });
  cab(`Filtros: ${r.filtros.join(" · ")}`, { size: 9, color: { argb: "FF64748B" } });
  if (r.observacao) cab(r.observacao, { size: 9, italic: true, color: { argb: "FF64748B" } });
  ws.addRow([]);

  const header = ws.addRow(r.colunas.map((c) => c.titulo.toUpperCase()));
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  header.height = 30;
  const primeira = header.number + 1;

  const razao = (c: Coluna, linha: number) => {
    const a = `${letra(idx.get(c.razao!.num)!)}${linha}`;
    const b = `${letra(idx.get(c.razao!.den)!)}${linha}`;
    return `IF(${b}=0,"",${a}/${b})`;
  };
  const celula = (c: Coluna, v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    if (c.tipo === "moeda") return Number(v) / 100;
    if (c.tipo === "percentual") return Number(v) / 100;
    if (c.tipo === "data") return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
    return v as ExcelJS.CellValue;
  };

  r.linhas.forEach((l, i) => {
    const num = primeira + i;
    ws.addRow(r.colunas.map((c) => {
      if (c.razao) {
        const d = Number(l[c.razao.den] ?? 0);
        return { formula: razao(c, num), result: d > 0 ? Number(l[c.razao.num] ?? 0) / d : "" };
      }
      return celula(c, l[c.chave]);
    }));
  });
  const ultima = primeira + r.linhas.length - 1;

  const t = totais(r);
  if (t && r.linhas.length) {
    const row = ws.addRow(r.colunas.map((c, i) => {
      if (i === 0) return "TOTAL";
      if (c.somar) return { formula: `SUM(${letra(i)}${primeira}:${letra(i)}${ultima})`, result: celula(c, t[c.chave]) as number };
      if (c.razao) return { formula: razao(c, ultima + 1), result: "" };
      return null;
    }));
    row.font = { bold: true };
    row.eachCell((c) => (c.border = { top: { style: "thin" } }));
  }

  r.colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.round((c.largura ?? (c.tipo === "texto" ? 3 : 1.6)) * 7);
    if (FMT[c.tipo]) col.numFmt = FMT[c.tipo]!;
  });
  ws.views = [{ state: "frozen", ySplit: header.number }];
  if (r.linhas.length) ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: ultima, column: n } };
  ws.pageSetup = { orientation: n > 7 ? "landscape" : "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

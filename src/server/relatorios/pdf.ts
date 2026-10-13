import PDFDocument from "pdfkit";
import { formatarCelula, totais, valorCalculado, type Linha, type Relatorio } from "@/lib/relatorios";

const COR = "#a51d1d";
const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function gerarPDF(r: Relatorio): Promise<Buffer> {
  const paisagem = r.colunas.length > 7;
  const doc = new PDFDocument({ size: "A4", layout: paisagem ? "landscape" : "portrait", margin: 36, bufferPages: true, info: { Title: r.titulo, Author: "Gestão do Mandato" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fim = new Promise<Buffer>((ok, erro) => {
    doc.on("end", () => ok(Buffer.concat(chunks)));
    doc.on("error", erro);
  });

  const x0 = doc.page.margins.left;
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pesos = r.colunas.map((c) => c.largura ?? (c.tipo === "texto" ? 3 : 1.6));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((p) => (p / soma) * largura);
  const fonte = r.colunas.length > 10 ? 7 : 8;
  const altura = fonte + 7;
  const limite = () => doc.page.height - doc.page.margins.bottom - 14;

  doc.fillColor(COR).font("Helvetica-Bold").fontSize(8).text("MANDATO PEDRO PATRUS — GESTÃO DO MANDATO");
  doc.fillColor("#0f172a").fontSize(15).text(r.titulo);
  doc.fillColor("#64748b").font("Helvetica").fontSize(8).text(`Filtros: ${r.filtros.join(" · ")}`);
  if (r.observacao) doc.font("Helvetica-Oblique").text(r.observacao).font("Helvetica");
  doc.moveDown(0.6);

  const linha = (l: Linha | string[], y: number, estilo: "cab" | "normal" | "total", zebra = false) => {
    if (estilo === "cab") doc.rect(x0, y, largura, altura + 4).fill(COR);
    else if (zebra) doc.rect(x0, y, largura, altura).fill("#f8fafc");
    if (estilo === "total") doc.moveTo(x0, y).lineTo(x0 + largura, y).lineWidth(0.7).stroke("#334155");
    doc.font(estilo === "normal" ? "Helvetica" : "Helvetica-Bold").fontSize(fonte).fillColor(estilo === "cab" ? "#ffffff" : "#0f172a");
    let x = x0;
    r.colunas.forEach((c, i) => {
      const txt = Array.isArray(l) ? l[i] : formatarCelula(valorCalculado(l, c), c.tipo);
      const direita = !Array.isArray(l) && c.tipo !== "texto" && c.tipo !== "data";
      doc.text(estilo === "total" && i === 0 ? "TOTAL" : txt, x + 3, y + 3, {
        width: larguras[i] - 6, height: estilo === "cab" ? altura * 2 : altura - 2, ellipsis: true, align: direita ? "right" : "left", lineBreak: estilo === "cab",
      });
      x += larguras[i];
    });
  };

  const cabecalho = () => {
    const y = doc.y;
    const h = Math.max(...r.colunas.map((c, i) => doc.font("Helvetica-Bold").fontSize(fonte).heightOfString(c.titulo, { width: larguras[i] - 6 }))) + 6;
    doc.rect(x0, y, largura, h).fill(COR);
    doc.font("Helvetica-Bold").fontSize(fonte).fillColor("#ffffff");
    let x = x0;
    r.colunas.forEach((c, i) => {
      doc.text(c.titulo, x + 3, y + 3, { width: larguras[i] - 6 });
      x += larguras[i];
    });
    doc.y = y + h;
  };

  cabecalho();
  if (!r.linhas.length) {
    doc.moveDown(0.5).font("Helvetica").fontSize(9).fillColor("#64748b").text("Nenhum registro encontrado com esses filtros.", x0);
  }
  r.linhas.forEach((l, i) => {
    if (doc.y + altura > limite()) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    linha(l, y, "normal", i % 2 === 1);
    doc.y = y + altura;
  });
  const t = totais(r);
  if (t && r.linhas.length) {
    if (doc.y + altura > limite()) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    linha(t, y, "total");
    doc.y = y + altura;
  }

  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    const m = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(
      `Gerado em ${dataHora.format(r.geradoEm)} por ${r.geradoPor} · página ${i + 1} de ${paginas.count}`,
      x0, doc.page.height - m + 10, { width: largura, align: "right", lineBreak: false },
    );
    doc.page.margins.bottom = m;
  }
  doc.end();
  return fim;
}

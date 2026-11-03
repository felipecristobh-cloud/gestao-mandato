import type { CategoriaDocumento } from "@prisma/client";

export const CATEGORIAS_DOCUMENTO = ["OFICIO", "PROTOCOLO", "NOTA", "COMPROVANTE", "FOTO", "PLANO_TRABALHO", "TERMO", "OUTRO"] as const satisfies readonly CategoriaDocumento[];

export const ROTULO_CATEGORIA: Record<CategoriaDocumento, string> = {
  OFICIO: "Ofício",
  PROTOCOLO: "Protocolo",
  NOTA: "Nota / nota técnica",
  COMPROVANTE: "Comprovante",
  FOTO: "Foto",
  PLANO_TRABALHO: "Plano de trabalho",
  TERMO: "Termo / convênio",
  OUTRO: "Outro",
};

export const TAMANHO_MAX = 10 * 1024 * 1024;

type Assinatura = "pdf" | "png" | "jpg" | "webp" | "docx" | "xlsx" | "odt" | "ods" | "ole";

/** Extensões aceitas. O tipo (MIME) gravado vem desta tabela, nunca do navegador. */
export const TIPOS_ACEITOS: Record<string, { mime: string; assinatura: Assinatura }> = {
  pdf: { mime: "application/pdf", assinatura: "pdf" },
  png: { mime: "image/png", assinatura: "png" },
  jpg: { mime: "image/jpeg", assinatura: "jpg" },
  jpeg: { mime: "image/jpeg", assinatura: "jpg" },
  webp: { mime: "image/webp", assinatura: "webp" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", assinatura: "docx" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", assinatura: "xlsx" },
  odt: { mime: "application/vnd.oasis.opendocument.text", assinatura: "odt" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", assinatura: "ods" },
  doc: { mime: "application/msword", assinatura: "ole" },
  xls: { mime: "application/vnd.ms-excel", assinatura: "ole" },
};

export const ACEITAR = Object.keys(TIPOS_ACEITOS).map((e) => `.${e}`).join(",");

export function extensao(nome: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

const comeca = (b: Uint8Array, bytes: number[], deslocamento = 0) => bytes.every((x, i) => b[deslocamento + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const contem = (b: Uint8Array, s: string) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes(s, 0, "latin1");
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Confere a assinatura (magic bytes) do conteúdo com a extensão: um .exe renomeado para .pdf é recusado. */
export function conteudoConfere(ext: string, b: Uint8Array): boolean {
  const t = TIPOS_ACEITOS[ext];
  if (!t || b.length < 8) return false;
  switch (t.assinatura) {
    case "pdf": return comeca(b, ascii("%PDF-"));
    case "png": return comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg": return comeca(b, [0xff, 0xd8, 0xff]);
    case "webp": return comeca(b, ascii("RIFF")) && comeca(b, ascii("WEBP"), 8);
    case "docx": return comeca(b, ZIP) && contem(b, "[Content_Types].xml") && contem(b, "word/");
    case "xlsx": return comeca(b, ZIP) && contem(b, "[Content_Types].xml") && contem(b, "xl/");
    case "odt": return comeca(b, ZIP) && contem(b.subarray(0, 120), "application/vnd.oasis.opendocument.text");
    case "ods": return comeca(b, ZIP) && contem(b.subarray(0, 120), "application/vnd.oasis.opendocument.spreadsheet");
    case "ole": return comeca(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
}

/** Nome para exibição/download: sem pastas, sem caracteres de controle, até 150 caracteres. */
export function nomeSeguro(nome: string) {
  const base = nome.split(/[\\/]/).pop() ?? "";
   
  const limpo = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "").replace(/\s+/g, " ").trim();
  if (limpo.length <= 150) return limpo;
  const ext = extensao(limpo);
  return `${limpo.slice(0, 149 - ext.length).trim()}.${ext}`;
}

export function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

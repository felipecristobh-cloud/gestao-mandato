import { describe, expect, it } from "vitest";
import { conteudoConfere, extensao, nomeSeguro } from "@/lib/documentos";
import { chaveCifra, cifrar, decifrar, novaChave } from "@/server/storage";
import { sanitizar } from "@/server/audit";
import { politicaSeguranca } from "@/middleware";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");

describe("documentos — tipo de arquivo", () => {
  it("confere assinatura com a extensão", () => {
    expect(conteudoConfere("pdf", pdf)).toBe(true);
    expect(conteudoConfere("png", png)).toBe(true);
    expect(conteudoConfere("pdf", exe)).toBe(false);
    expect(conteudoConfere("png", pdf)).toBe(false);
    expect(conteudoConfere("exe", exe)).toBe(false);
  });

  it("nome seguro tira pastas e caracteres perigosos", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd");
    expect(nomeSeguro("C:\\x\\Ofício \"nº 1\".pdf")).toBe("Ofício nº 1.pdf");
    expect(extensao(nomeSeguro(`${"a".repeat(300)}.pdf`))).toBe("pdf");
    expect(nomeSeguro(`${"a".repeat(300)}.pdf`).length).toBeLessThanOrEqual(150);
  });
});

describe("documentos — criptografia", () => {
  it("cifra e decifra; arquivo trocado de lugar não abre", () => {
    const k = novaChave();
    const c = cifrar(k, pdf);
    expect(c.includes(pdf)).toBe(false);
    expect(decifrar(k, c).equals(pdf)).toBe(true);
    expect(() => decifrar(novaChave(), c)).toThrow();
    const adulterado = Buffer.from(c);
    adulterado[adulterado.length - 1] ^= 1;
    expect(() => decifrar(k, adulterado)).toThrow();
  });

  it("produção exige DOCUMENTOS_CHAVE válida", () => {
    expect(() => chaveCifra({ NODE_ENV: "production" })).toThrow(/DOCUMENTOS_CHAVE/);
    expect(() => chaveCifra({ DOCUMENTOS_CHAVE: "curta" })).toThrow(/32 bytes/);
    expect(chaveCifra({ DOCUMENTOS_CHAVE: "ab".repeat(32) }).length).toBe(32);
  });
});

describe("segurança geral", () => {
  it("auditoria guarda telefone e e-mail mascarados e nunca senha", () => {
    expect(sanitizar({ nome: "A", telefone: "31999998888", email: "maria@ex.com", senhaHash: "x" })).toEqual({
      nome: "A", telefone: "(••) •••••-8888", email: "m•••@ex.com",
    });
  });

  it("CSP bloqueia script externo, frames e objetos", () => {
    const p = politicaSeguranca("abc", false);
    expect(p).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(p).not.toContain("unsafe-eval");
    expect(p).toContain("frame-ancestors 'none'");
    expect(p).toContain("object-src 'none'");
    expect(p).toContain("https://tile.openstreetmap.org");
  });
});

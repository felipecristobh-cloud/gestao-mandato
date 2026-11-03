import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Onde os arquivos ficam. Hoje: disco do servidor (fora da pasta pública). Na produção: storage compatível com S3 (Fase 10). */
export type Storage = {
  salvar(chave: string, dados: Buffer): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  remover(chave: string): Promise<void>;
};

const FORMATO_CHAVE = /^\d{4}\/\d{2}\/[0-9a-f-]{36}$/;
const CABECALHO = Buffer.from("GMD1");

export function novaChave(agora = new Date()) {
  return `${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
}

function conferirChave(chave: string) {
  if (!FORMATO_CHAVE.test(chave)) throw new Error("Chave de documento inválida.");
}

/** Chave AES-256 de DOCUMENTOS_CHAVE (32 bytes em base64 ou hex). Fora da produção, usa uma chave fixa de desenvolvimento. */
export function chaveCifra(env: Record<string, string | undefined> = process.env): Buffer {
  const bruta = env.DOCUMENTOS_CHAVE?.trim();
  if (bruta) {
    const k = /^[0-9a-f]{64}$/i.test(bruta) ? Buffer.from(bruta, "hex") : Buffer.from(bruta, "base64");
    if (k.length !== 32) throw new Error("DOCUMENTOS_CHAVE precisa ter 32 bytes (base64 ou hex).");
    return k;
  }
  if (env.NODE_ENV === "production") throw new Error("Defina DOCUMENTOS_CHAVE para guardar documentos em produção.");
  return createHash("sha256").update("gestao-mandato-chave-de-desenvolvimento").digest();
}

/** AES-256-GCM. O nome do arquivo no storage entra como dado autenticado: trocar arquivos de lugar invalida a leitura. */
export function cifrar(chave: string, dados: Buffer, k = chaveCifra()) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  c.setAAD(Buffer.from(chave));
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([CABECALHO, iv, c.getAuthTag(), corpo]);
}

export function decifrar(chave: string, dados: Buffer, k = chaveCifra()) {
  if (!dados.subarray(0, 4).equals(CABECALHO)) throw new Error("Arquivo de documento corrompido.");
  const d = createDecipheriv("aes-256-gcm", k, dados.subarray(4, 16));
  d.setAAD(Buffer.from(chave));
  d.setAuthTag(dados.subarray(16, 32));
  return Buffer.concat([d.update(dados.subarray(32)), d.final()]);
}

export function storageLocal(dir = process.env.DOCUMENTOS_DIR || path.join(process.cwd(), ".dados", "documentos")): Storage {
  const arquivo = (chave: string) => {
    conferirChave(chave);
    return path.join(dir, ...chave.split("/"));
  };
  return {
    async salvar(chave, dados) {
      const p = arquivo(chave);
      await mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
      await writeFile(p, cifrar(chave, dados), { mode: 0o600, flag: "wx" });
    },
    async ler(chave) {
      return decifrar(chave, await readFile(arquivo(chave)));
    },
    async remover(chave) {
      await rm(arquivo(chave), { force: true });
    },
  };
}

let padrao: Storage | undefined;
export const storagePadrao = () => (padrao ??= storageLocal());

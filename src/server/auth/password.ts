import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

const OPCOES = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashSenha(senha: string) {
  return hash(senha, OPCOES);
}

export async function verificarSenha(senhaHash: string, senha: string) {
  try {
    return await verify(senhaHash, senha);
  } catch {
    return false;
  }
}

export function validarPoliticaSenha(senha: string): string | null {
  if (senha.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) return "A senha deve ter letras e números.";
  return null;
}

export function gerarSenhaTemporaria() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let s = "";
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return s.slice(0, 8) + String(bytes[0] % 10) + String(bytes[1] % 10);
}

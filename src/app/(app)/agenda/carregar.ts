import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { obterCompromisso } from "@/server/services/agenda";
import type { Ator } from "@/server/authz";

export async function carregarCompromisso(ator: Ator, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return obterCompromisso(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
}

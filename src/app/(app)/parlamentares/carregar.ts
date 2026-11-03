import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { obterParlamentar } from "@/server/services/parlamentares";
import type { Ator } from "@/server/authz";

export async function carregarParlamentar(ator: Ator, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return obterParlamentar(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
}

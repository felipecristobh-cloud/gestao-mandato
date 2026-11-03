import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { obterDemanda } from "@/server/services/demandas";
import type { Ator } from "@/server/authz";

export async function carregarDemanda(ator: Ator, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return obterDemanda(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { versoesTexto } from "@/server/services/oportunidades";
import { CabecalhoPagina, Cartao, Selo } from "@/components/ui";
import { ROTULO_TEXTO } from "@/lib/oportunidades";

export const metadata: Metadata = { title: "Versões do texto" };

const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function VersoesTextoPage({ params }: { params: Promise<{ id: string; tipo: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id, tipo } = await params;
  const r = await versoesTexto(prisma, ator, id, tipo).catch((e) => {
    if (e instanceof AppError && (e.code === "NAO_ENCONTRADO" || e.code === "VALIDACAO")) notFound();
    throw e;
  });
  return (
    <>
      <Link href={`/oportunidades/${id}`} className="text-sm text-slate-600 hover:underline">← {r.oportunidade.nome}</Link>
      <CabecalhoPagina titulo={ROTULO_TEXTO[r.tipo]} descricao={`${r.versoes.length} versão(ões), da mais nova para a mais antiga`} />
      <div className="space-y-4">
        {r.versoes.map((v, i) => (
          <Cartao key={v.id}>
            <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Selo cor={i === 0 ? "azul" : "cinza"}>Versão {v.versao}{i === 0 ? " (atual)" : ""}</Selo>
              {data(v.criadoEm)} · {v.autor?.nome ?? "—"}
            </p>
            <p className="whitespace-pre-line text-sm text-slate-800">{v.conteudo}</p>
          </Cartao>
        ))}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { opcoesFormOportunidade, preencherDeOrigem } from "@/server/services/oportunidades";
import { criarOportunidadeAction } from "@/server/services/oportunidades-actions";
import { Aviso, CabecalhoPagina, Cartao } from "@/components/ui";
import { FormOportunidade } from "@/components/forms/oportunidade";

export const metadata: Metadata = { title: "Nova oportunidade" };

export default async function NovaOportunidadePage({ searchParams }: { searchParams: Promise<{ demanda?: string; compromisso?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:criar");
  const sp = await searchParams;
  const origem = { demandaId: sp.demanda ?? null, compromissoId: sp.demanda ? null : (sp.compromisso ?? null) };
  const [opcoes, preenchido] = await Promise.all([
    opcoesFormOportunidade(prisma),
    preencherDeOrigem(prisma, ator, origem).catch((e) => {
      if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
      throw e;
    }),
  ]);
  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina
        titulo={preenchido ? "Transformar em proposta legislativa" : "Nova oportunidade"}
        descricao="Cadastre a ideia. A avaliação, a etapa e os textos ficam na página da proposta."
      />
      {preenchido && (
        <div className="mb-4 max-w-3xl">
          <Aviso tipo="info">
            Dados copiados da {preenchido.rotulo}. O registro original não muda. Nome e contato do cidadão não são copiados: revise o texto e retire qualquer dado pessoal.
          </Aviso>
        </div>
      )}
      <Cartao className="max-w-3xl">
        <FormOportunidade
          acao={criarOportunidadeAction}
          opcoes={opcoes}
          valores={{ responsavelId: ator.id, ...(preenchido?.valores ?? {}) }}
          origem={origem.demandaId ? { campo: "origemDemanda", id: origem.demandaId } : origem.compromissoId ? { campo: "origemCompromisso", id: origem.compromissoId } : undefined}
        />
      </Cartao>
    </>
  );
}

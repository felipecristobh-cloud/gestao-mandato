import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { obterOportunidade } from "@/server/services/oportunidades";
import { avaliarOportunidadeAction, definirPrioridadeAction } from "@/server/services/oportunidades-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { FormAvaliacao, FormPrioridade } from "@/components/forms/oportunidade";
import { AVISO_JURIDICO, COR_PRIORIDADE_OPORTUNIDADE, CRITERIOS, ROTULO_PRIORIDADE_OPORTUNIDADE } from "@/lib/oportunidades";

export const metadata: Metadata = { title: "Oportunidade legislativa" };

const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-xs font-semibold uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-800">{children || "—"}</dd>
    </div>
  );
}

export default async function OportunidadePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await obterOportunidade(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
  const notas = Object.fromEntries(CRITERIOS.map((c) => [c.campo, o[c.campo]]));

  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina
        titulo={o.nome}
        descricao={`${o.eixo.nome} · cadastrada em ${data(o.criadoEm)}${o.criadoPor ? ` por ${o.criadoPor.nome}` : ""}`}
        acoes={o.podeEditar ? <Link href={`/oportunidades/${id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {sp.criada && <div className="mb-4"><Aviso tipo="ok">Oportunidade cadastrada. Agora faça a avaliação.</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item rotulo="Problema social">{o.problema}</Item>
              <Item rotulo="Descrição detalhada">{o.descricaoProblema}</Item>
              <Item rotulo="Público beneficiado">{o.publico}</Item>
              <Item rotulo="Objetivo">{o.objetivo}</Item>
              <Item rotulo="Solução legislativa">{o.solucao}</Item>
              <Item rotulo="Resultados esperados">{o.resultados}</Item>
              <Item rotulo="Regionais">{o.regionais.map((r) => r.regional.nome).join(", ")}</Item>
              <Item rotulo="Bairros">{o.bairros.map((b) => `${b.bairro.nome} (${b.bairro.regional.nome})`).join(", ")}</Item>
            </dl>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Pesquisa preliminar</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item rotulo="Fundamentação jurídica preliminar">{o.fundamentacao}</Item>
              <Item rotulo="Legislação municipal relacionada">{o.legislacaoRelacionada}</Item>
              <Item rotulo="Projetos semelhantes">{o.projetosSemelhantes}</Item>
              <Item rotulo="Possíveis parceiros">{o.parceiros}</Item>
            </dl>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Histórico</h2>
            <ol className="space-y-2 text-sm">
              {o.historico.map((h) => (
                <li key={h.id} className="border-l-2 border-marca-200 pl-3">
                  <p className="text-slate-800">{h.descricao}</p>
                  <p className="text-xs text-slate-500">{data(h.data)}{h.usuario ? ` · ${h.usuario.nome}` : ""}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao>
            <h2 className="text-base font-semibold text-slate-900">Prioridade</h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{o.notaFinal ?? "—"}<span className="text-base font-normal text-slate-500"> / 100</span></p>
            <p className="mt-2">{o.prioridade ? <Selo cor={COR_PRIORIDADE_OPORTUNIDADE[o.prioridade]}>{ROTULO_PRIORIDADE_OPORTUNIDADE[o.prioridade]}</Selo> : <Selo>Sem avaliação</Selo>}</p>
            {o.prioridadeManual && (
              <p className="mt-2 text-xs text-slate-600">
                Definida manualmente{o.prioridadeCalculada ? ` (pela nota seria ${ROTULO_PRIORIDADE_OPORTUNIDADE[o.prioridadeCalculada].toLowerCase()})` : ""}. Justificativa: {o.justificativaPrioridade}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">Responsável: {o.responsavel?.nome ?? "—"}</p>
            {!o.podeEditar && <p className="mt-3 text-xs text-slate-500">{AVISO_JURIDICO}</p>}
          </Cartao>
          {o.podeEditar && (
            <Cartao>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Avaliação (0 a 5)</h2>
              <FormAvaliacao acao={avaliarOportunidadeAction.bind(null, id)} valores={notas} />
            </Cartao>
          )}
          {o.podePriorizar && (
            <Cartao>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Mudar prioridade na mão</h2>
              <FormPrioridade acao={definirPrioridadeAction.bind(null, id)} atual={o.prioridadeManual} />
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { obterOportunidade, opcoesVinculoOportunidade } from "@/server/services/oportunidades";
import {
  avaliarOportunidadeAction, definirPrioridadeAction, desvincularOportunidadeAction, etapaOportunidadeAction, textoOportunidadeAction, vincularOportunidadeAction,
} from "@/server/services/oportunidades-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { FormAvaliacao, FormEtapa, FormPrioridade, FormTexto, FormVinculoOportunidade } from "@/components/forms/oportunidade";
import { BotaoConfirmar } from "@/components/forms/parlamentar";
import { CartaoDocumentos } from "@/components/documentos/cartao";
import {
  AVISO_JURIDICO, COR_ETAPA, COR_PRIORIDADE_OPORTUNIDADE, CRITERIOS, ETAPAS_COORDENACAO, ETAPAS_OPORTUNIDADE, ROTULO_ETAPA, ROTULO_PRIORIDADE_OPORTUNIDADE,
} from "@/lib/oportunidades";

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
  const opcoesVinculo = o.podeEditar ? await opcoesVinculoOportunidade(prisma) : null;
  const travada = !o.podePriorizar && ETAPAS_COORDENACAO.has(o.etapa);
  const etapas = ETAPAS_OPORTUNIDADE.map((e) => ({ valor: e, bloqueada: !o.podePriorizar && ETAPAS_COORDENACAO.has(e) }));
  const passo = ETAPAS_OPORTUNIDADE.indexOf(o.etapa) + 1;

  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina
        titulo={o.nome}
        descricao={`${o.eixo.nome} · cadastrada em ${data(o.criadoEm)}${o.criadoPor ? ` por ${o.criadoPor.nome}` : ""}`}
        acoes={o.podeEditar ? <Link href={`/oportunidades/${id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {sp.criada && <div className="mb-4"><Aviso tipo="ok">Oportunidade cadastrada. Agora faça a avaliação.</Aviso></div>}
      {o.demandaOrigem && (
        <p className="mb-4 text-sm text-slate-600">
          Surgiu da demanda <Link href={`/demandas/${o.demandaOrigem.id}`} className="font-medium text-marca-800 hover:underline">{o.demandaOrigem.protocolo}</Link>.
        </p>
      )}

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
            <h2 className="text-base font-semibold text-slate-900">Textos do projeto</h2>
            <p className="mb-3 text-xs text-slate-500">Cada vez que salva, vira uma versão nova. As anteriores ficam guardadas com autor e data. Nada aqui é protocolado na Câmara.</p>
            <div className="divide-y divide-slate-100">
              {o.textosAtuais.map((t) => (
                <details key={t.tipo} className="py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                    {t.rotulo}
                    {t.atual ? <Selo cor="azul">Versão {t.atual.versao}</Selo> : <Selo>Vazio</Selo>}
                    {t.atual && <span className="text-xs font-normal text-slate-500">{data(t.atual.criadoEm)}{t.atual.autor ? ` · ${t.atual.autor.nome}` : ""}</span>}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {o.podeEditar && (!t.coordenacao || o.podePriorizar)
                      ? <FormTexto acao={textoOportunidadeAction.bind(null, id, t.tipo)} tipo={t.tipo} atual={t.atual?.conteudo ?? ""} />
                      : <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-800">{t.atual?.conteudo ?? "—"}</p>}
                    {t.coordenacao && o.podeEditar && !o.podePriorizar && <p className="text-xs text-slate-500">Só a coordenação registra a versão final aprovada.</p>}
                    {t.versoes > 1 && <Link href={`/oportunidades/${id}/textos/${t.tipo}`} className="text-xs text-marca-800 hover:underline">Ver as {t.versoes} versões</Link>}
                  </div>
                </details>
              ))}
            </div>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Vínculos com o mandato</h2>
            {o.vinculos.length === 0 && <p className="text-sm text-slate-500">Nenhuma demanda, emenda ou compromisso vinculado.</p>}
            <ul className="space-y-2 text-sm">
              {o.vinculos.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2">
                  {v.demanda && <><Selo>Demanda</Selo><Link href={`/demandas/${v.demanda.id}`} className="font-medium text-marca-800 hover:underline">{v.demanda.protocolo}</Link><span className="text-slate-600">{v.demanda.tema.nome}</span></>}
                  {v.emenda && <><Selo>Emenda</Selo><Link href={`/emendas/${v.emenda.id}`} className="font-medium text-marca-800 hover:underline">{v.emenda.codigo}</Link><span className="line-clamp-1 text-slate-600">{v.emenda.objeto}</span></>}
                  {v.compromisso && <><Selo>Agenda</Selo><Link href={`/agenda/${v.compromisso.id}`} className="font-medium text-marca-800 hover:underline">{v.compromisso.titulo}</Link><span className="text-slate-600">{data(v.compromisso.inicio)}</span></>}
                  {v.demandaId && v.demandaId === o.demandaOrigemId && <Selo cor="azul">Origem</Selo>}
                  {o.podeEditar && !(v.demandaId && v.demandaId === o.demandaOrigemId) && (
                    <span className="ml-auto"><BotaoConfirmar acao={desvincularOportunidadeAction.bind(null, id, v.id)} rotulo="Remover" pergunta="Remover este vínculo?" /></span>
                  )}
                </li>
              ))}
            </ul>
            {opcoesVinculo && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Vincular demanda, emenda ou compromisso</summary>
                <div className="mt-3"><FormVinculoOportunidade acao={vincularOportunidadeAction.bind(null, id)} opcoes={opcoesVinculo} /></div>
              </details>
            )}
          </Cartao>
          <CartaoDocumentos ator={ator} tipo="oportunidade" id={id} podeAnexar={o.podeEditar} titulo="Documentos, estudos e minutas" />
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
            <h2 className="text-base font-semibold text-slate-900">Etapa</h2>
            <p className="mt-2"><Selo cor={COR_ETAPA[o.etapa]}>{passo}. {ROTULO_ETAPA[o.etapa]}</Selo></p>
            {o.podeEditar && !travada && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <FormEtapa acao={etapaOportunidadeAction.bind(null, id)} atual={o.etapa} etapas={etapas} rotulos={ROTULO_ETAPA} />
              </div>
            )}
            {o.podeEditar && travada && <p className="mt-2 text-xs text-slate-500">Nesta etapa só a coordenação muda.</p>}
          </Cartao>
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

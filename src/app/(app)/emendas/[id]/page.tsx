import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesEmenda, rotuloEmendaVinculo } from "@/server/services/emendas";
import {
  comentarEmendaAction, desvincularMandatoEmendaAction, documentoAction, excluirLancamentoAction, lancamentoAction,
  removerDocumentoAction, statusEmendaAction, vincularMandatoEmendaAction,
} from "@/server/services/emendas-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { BotaoConfirmar } from "@/components/forms/parlamentar";
import { FormComentarioEmenda, FormDocumentoEmenda, FormLancamento, FormStatusEmenda, FormVinculoEmenda } from "@/components/forms/emenda";
import { formatarData, hojeISO } from "@/lib/demandas";
import {
  COR_STATUS_EMENDA, ROTULO_DOCUMENTO, ROTULO_HISTORICO_EMENDA, ROTULO_LANCAMENTO, ROTULO_STATUS_EMENDA, ROTULO_TIPO_EMENDA,
  centavos, formatarCnpj, formatarMoeda,
} from "@/lib/emendas";
import { ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO } from "@/lib/parlamentares";
import { carregarEmenda } from "../carregar";

export const metadata: Metadata = { title: "Emenda" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Item({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-3" : undefined}>
      <dt className="text-xs font-medium uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

function Valor({ rotulo, valor, ajuda, destaque }: { rotulo: string; valor: number | null; ajuda?: string; destaque?: boolean }) {
  return (
    <div className={destaque ? "rounded-lg bg-marca-50 p-3" : "rounded-lg bg-slate-50 p-3"}>
      <p className="text-xs font-medium uppercase text-slate-500">{rotulo}</p>
      <p className="mt-1 font-semibold tabular-nums text-slate-900">{valor === null ? "—" : formatarMoeda(valor)}</p>
      {ajuda && <p className="text-xs text-slate-500">{ajuda}</p>}
    </div>
  );
}

export default async function EmendaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, { criada }] = await Promise.all([params, searchParams]);
  const e = await carregarEmenda(ator, id);
  const opcoes = e.podeEditar ? await opcoesEmenda(prisma) : null;
  const v = e.valores;
  const r = e.resumo;
  const pctPago = Math.min(100, r.percentualPago);

  return (
    <>
      <Link href="/emendas" className="text-sm text-slate-600 hover:underline">← Emendas</Link>
      <CabecalhoPagina
        titulo={e.codigo}
        descricao={`${rotuloEmendaVinculo(e)} · ${ROTULO_ESFERA[e.esfera]} · ${ROTULO_TIPO_EMENDA[e.tipo]}`}
        acoes={e.podeEditar ? <Link href={`/emendas/${e.id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {criada && <div className="mb-4"><Aviso tipo="ok">Emenda cadastrada. Agora vincule os mandatos (inclusive o autor) e registre a execução.</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Selo cor={COR_STATUS_EMENDA[e.status]}>{ROTULO_STATUS_EMENDA[e.status]}</Selo>
              {e.autor ? (
                <Selo cor="azul">Autor: {e.autor.mandato.parlamentar.nome}</Selo>
              ) : (
                <Selo>Autor não informado</Selo>
              )}
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item rotulo="Objeto" largo>{e.objeto}</Item>
              {e.justificativa && <Item rotulo="Justificativa" largo>{e.justificativa}</Item>}
              <Item rotulo="Beneficiário">{e.beneficiario}</Item>
              <Item rotulo="CNPJ">{formatarCnpj(e.cnpj)}</Item>
              <Item rotulo="Município">{e.municipio}</Item>
              <Item rotulo="Bairro / regional">{e.bairro ? `${e.bairro.nome} · ${e.bairro.regional.nome}` : null}</Item>
              <Item rotulo="Órgão">{e.orgao ? (e.orgao.sigla ? `${e.orgao.sigla} — ${e.orgao.nome}` : e.orgao.nome) : null}</Item>
              <Item rotulo="Secretaria">{e.secretaria}</Item>
              <Item rotulo="Programa">{e.programa}</Item>
              <Item rotulo="Ação">{e.acaoOrcamentaria}</Item>
              <Item rotulo="Prazo">{e.prazo ? formatarData(e.prazo) : null}</Item>
              <Item rotulo="Responsável interno">{e.responsavel?.nome}</Item>
              <Item rotulo="Cadastrada por">{e.criadoPor?.nome}</Item>
            </dl>
            {e.observacoes && <p className="mt-4 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">{e.observacoes}</p>}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Valores e execução</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Valor rotulo="Indicado" valor={v.indicado} />
              <Valor rotulo="Aprovado" valor={v.aprovado} ajuda={v.aprovado === null ? "ainda não aprovado" : undefined} />
              <Valor rotulo="Empenhado" valor={v.empenhado} ajuda={`falta empenhar ${formatarMoeda(r.aEmpenhar)}`} />
              <Valor rotulo="Liquidado" valor={v.liquidado} ajuda={`a liquidar ${formatarMoeda(r.aLiquidar)}`} />
              <Valor rotulo="Pago" valor={v.pago} ajuda={`${r.percentualPago}% do ${v.aprovado === null ? "indicado" : "aprovado"}`} />
              <Valor rotulo="Saldo a pagar" valor={r.saldo} ajuda="empenhado − pago" destaque />
            </div>
            <div className="mt-3" aria-hidden>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-green-600" style={{ width: `${pctPago}%` }} /></div>
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Lançamentos</h3>
            {e.lancamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lançamento de empenho, liquidação ou pagamento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Lançamentos de execução</caption>
                  <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th scope="col" className="py-2 pr-3">Data</th>
                      <th scope="col" className="py-2 pr-3">Tipo</th>
                      <th scope="col" className="py-2 pr-3 text-right">Valor</th>
                      <th scope="col" className="py-2 pr-3">Documento</th>
                      <th scope="col" className="py-2"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {e.lancamentos.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3">{formatarData(l.data)}</td>
                        <td className="py-2 pr-3">{ROTULO_LANCAMENTO[l.tipo]}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(centavos(l.valor))}</td>
                        <td className="py-2 pr-3 text-slate-600">{[l.documento, l.observacoes].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="py-2 text-right">
                          {e.podeEditar && <BotaoConfirmar acao={excluirLancamentoAction.bind(null, e.id, l.id)} rotulo="Excluir" pergunta="Excluir este lançamento?" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {e.podeEditar && e.status !== "CANCELADA" && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Registrar empenho, liquidação ou pagamento</summary>
                <div className="mt-3"><FormLancamento acao={lancamentoAction.bind(null, e.id)} hoje={hojeISO()} /></div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-1 text-base font-semibold">Mandatos envolvidos</h2>
            <p className="mb-3 text-xs text-slate-500">Autoria só existe quando cadastrada aqui como &quot;Autor&quot; ou &quot;Coautor&quot;. Acompanhar, articular ou executar não é autoria.</p>
            {e.mandatos.length === 0 && <p className="text-sm text-slate-500">Nenhum mandato vinculado.</p>}
            <ul className="divide-y divide-slate-100">
              {e.mandatos.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo cor={m.tipo === "AUTOR" || m.tipo === "COAUTOR" ? "verde" : "azul"}>{ROTULO_PARTICIPACAO[m.tipo]}</Selo>
                    <Link href={`/parlamentares/${m.mandato.parlamentar.id}`} className="font-medium text-marca-800 hover:underline">{m.mandato.parlamentar.nome}</Link>
                    {m.mandato.parlamentar.proprio && <Selo>Mandato próprio</Selo>}
                    <span className="text-xs text-slate-500">
                      {ROTULO_CARGO[m.mandato.cargo]}{m.mandato.legislatura ? `, ${m.mandato.legislatura}` : ""}{m.mandato.partido ?? m.mandato.parlamentar.partido ? ` · ${m.mandato.partido ?? m.mandato.parlamentar.partido}` : ""}
                    </span>
                    {e.podeEditar && (
                      <span className="ml-auto">
                        <BotaoConfirmar acao={desvincularMandatoEmendaAction.bind(null, e.id, m.id)} rotulo="Remover" pergunta="Remover este vínculo?" />
                      </span>
                    )}
                  </div>
                  {(m.responsabilidade || m.dataInicio || m.dataFim || m.observacoes) && (
                    <p className="mt-1 text-slate-600">
                      {[
                        m.responsabilidade,
                        m.dataInicio || m.dataFim ? `${m.dataInicio ? formatarData(m.dataInicio) : "…"} a ${m.dataFim ? formatarData(m.dataFim) : "em aberto"}` : null,
                        m.observacoes,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {opcoes && (
              <details className="mt-4" open={e.mandatos.length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Vincular mandato</summary>
                <div className="mt-3"><FormVinculoEmenda acao={vincularMandatoEmendaAction.bind(null, e.id)} opcoes={opcoes.mandatos} /></div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-1 text-base font-semibold">Documentos</h2>
            <p className="mb-3 text-xs text-slate-500">Referências (ofício, processo SEI, link). O envio de arquivos chega com o módulo Documentos.</p>
            {e.documentos.length === 0 && <p className="text-sm text-slate-500">Nenhum documento registrado.</p>}
            <ul className="divide-y divide-slate-100">
              {e.documentos.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Selo>{ROTULO_DOCUMENTO[d.tipo]}</Selo>
                  {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-marca-800 hover:underline">{d.descricao}</a> : <span className="font-medium">{d.descricao}</span>}
                  <span className="text-xs text-slate-500">{[d.numero && `nº ${d.numero}`, d.data && formatarData(d.data)].filter(Boolean).join(" · ")}</span>
                  {e.podeEditar && <span className="ml-auto"><BotaoConfirmar acao={removerDocumentoAction.bind(null, e.id, d.id)} rotulo="Remover" pergunta="Remover este documento?" /></span>}
                </li>
              ))}
            </ul>
            {e.podeEditar && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Registrar documento</summary>
                <div className="mt-3"><FormDocumentoEmenda acao={documentoAction.bind(null, e.id)} /></div>
              </details>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          {e.podeEditar && (
            <Cartao>
              <h2 className="mb-3 text-base font-semibold">Status</h2>
              <FormStatusEmenda acao={statusEmendaAction.bind(null, e.id)} atual={e.status} />
              <hr className="my-4 border-slate-200" />
              <FormComentarioEmenda acao={comentarEmendaAction.bind(null, e.id)} />
            </Cartao>
          )}
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico</h2>
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {e.historico.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-xs text-slate-500">{fmt.format(h.data)} · {h.usuario?.nome ?? "Sistema"} · {ROTULO_HISTORICO_EMENDA[h.tipo]}</p>
                  <p className="whitespace-pre-line text-slate-800">{h.descricao}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}

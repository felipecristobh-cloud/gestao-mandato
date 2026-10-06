import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesDemanda } from "@/server/services/demandas";
import { alterarStatusAction, comentarAction, encaminharAction, registrarRetornoAction } from "@/server/services/demandas-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { FormComentario, FormEncaminhar, FormRetorno, FormStatus } from "@/components/forms/demanda";
import {
  COR_STATUS, ROTULO_HISTORICO, ROTULO_PRIORIDADE, ROTULO_STATUS, ROTULO_TIPO, formatarData, rotuloPrazo, situacaoPrazo, hojeISO, deISO,
} from "@/lib/demandas";
import { carregarDemanda } from "./carregar";

export const metadata: Metadata = { title: "Demanda" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

export default async function DemandaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, { criada }] = await Promise.all([params, searchParams]);
  const d = await carregarDemanda(ator, id);
  const opcoes = d.podeEditar ? await opcoesDemanda(prisma) : null;
  const prazo = rotuloPrazo(situacaoPrazo(d.prazo, d.status));
  const hoje = deISO(hojeISO()).getTime();

  return (
    <>
      <Link href="/demandas" className="text-sm text-slate-600 hover:underline">← Demandas</Link>
      <CabecalhoPagina
        titulo={d.protocolo}
        descricao={`${d.tema.nome} · entrada em ${formatarData(d.dataEntrada)}`}
        acoes={d.podeEditar ? <Link href={`/demandas/${d.id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {criada && <div className="mb-4"><Aviso tipo="ok">Demanda cadastrada com o protocolo {d.protocolo}.</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Selo cor={COR_STATUS[d.status]}>{ROTULO_STATUS[d.status]}</Selo>
              <Selo cor={prazo.cor}>{prazo.texto}</Selo>
              <Selo cor={d.prioridade === "URGENTE" ? "vermelho" : d.prioridade === "ALTA" ? "amarelo" : "cinza"}>Prioridade {ROTULO_PRIORIDADE[d.prioridade].toLowerCase()}</Selo>
            </div>
            <p className="whitespace-pre-line text-sm text-slate-800">{d.descricao}</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <Item rotulo="Tipo">{ROTULO_TIPO[d.tipo]}</Item>
              <Item rotulo="Responsável">{d.responsavel?.nome ?? <span className="text-amber-700">Sem responsável</span>}</Item>
              <Item rotulo="Prazo">{formatarData(d.prazo)}</Item>
              <Item rotulo="Endereço">{d.endereco}</Item>
              <Item rotulo="Bairro / regional">{d.bairro ? `${d.bairro.nome} · ${d.bairro.regional.nome}` : ""}</Item>
              <Item rotulo="Órgão">{d.orgao ? d.orgao.sigla ?? d.orgao.nome : ""}</Item>
              <Item rotulo="Conclusão">{d.dataConclusao ? formatarData(d.dataConclusao) : ""}</Item>
              <Item rotulo="Cadastrada por">{d.criadoPor?.nome}</Item>
            </dl>
            {d.observacoes && (
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-medium uppercase text-slate-500">Observações internas</p>
                <p className="mt-1 whitespace-pre-line">{d.observacoes}</p>
              </div>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Encaminhamentos</h2>
            {d.encaminhamentos.length === 0 && <p className="text-sm text-slate-500">Nenhum encaminhamento ainda.</p>}
            <ul className="space-y-3">
              {d.encaminhamentos.map((e) => {
                const atrasado = !e.retorno && e.prazoRetorno && e.prazoRetorno.getTime() < hoje;
                return (
                  <li key={e.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{e.orgao.sigla ?? e.orgao.nome}</strong>
                      <span className="text-slate-500">em {formatarData(e.data)}{e.usuario ? ` por ${e.usuario.nome}` : ""}</span>
                      {e.protocolo && <Selo>Protocolo {e.protocolo}</Selo>}
                      {e.retorno ? <Selo cor="verde">Respondido</Selo> : <Selo cor={atrasado ? "vermelho" : "amarelo"}>{atrasado ? "Retorno atrasado" : "Aguardando retorno"}</Selo>}
                    </div>
                    <p className="mt-1 text-slate-700">{e.descricao}</p>
                    {e.prazoRetorno && <p className="text-xs text-slate-500">Prazo de retorno: {formatarData(e.prazoRetorno)}</p>}
                    {e.retorno && <p className="mt-2 rounded bg-green-50 p-2 text-green-900">Retorno ({formatarData(e.dataRetorno)}): {e.retorno}</p>}
                    {!e.retorno && d.podeEditar && <FormRetorno id={e.id} acao={registrarRetornoAction.bind(null, d.id, e.id)} />}
                  </li>
                );
              })}
            </ul>
            {opcoes && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Encaminhar a um órgão</summary>
                <div className="mt-3"><FormEncaminhar acao={encaminharAction.bind(null, d.id)} orgaos={opcoes.orgaos} /></div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico</h2>
            {d.podeEditar && <div className="mb-4"><FormComentario acao={comentarAction.bind(null, d.id)} /></div>}
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {d.historico.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-xs text-slate-500">
                    {fmt.format(h.data)} · {h.usuario?.nome ?? "Sistema"} · <span className="font-medium">{ROTULO_HISTORICO[h.tipo]}</span>
                  </p>
                  <p className="text-slate-800">{h.descricao}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Solicitante</h2>
            <dl className="space-y-3">
              <Item rotulo="Nome">{d.pessoa.nome}</Item>
              <Item rotulo="Telefone">{d.pessoa.telefone}</Item>
              <Item rotulo="E-mail">{d.pessoa.email}</Item>
            </dl>
            {!d.contatoVisivel && (d.pessoa.telefone || d.pessoa.email) && (
              <p className="mt-3 text-xs text-slate-500">Contato parcialmente oculto (LGPD): só o responsável, quem cadastrou e a coordenação veem completo.</p>
            )}
          </Cartao>
          {d.podeEditar && (
            <Cartao>
              <h2 className="mb-3 text-base font-semibold">Status</h2>
              <FormStatus acao={alterarStatusAction.bind(null, d.id)} atual={d.status} />
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}

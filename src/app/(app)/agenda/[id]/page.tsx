import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { buscarChoques, opcoesAlvos } from "@/server/services/agenda";
import {
  comentarCompromissoAction, desvincularCompromissoAction, resultadoCompromissoAction, statusCompromissoAction, vincularCompromissoAction,
} from "@/server/services/agenda-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { BotaoConfirmar } from "@/components/forms/parlamentar";
import { FormComentarioCompromisso, FormResultado, FormStatusCompromisso, FormVinculoCompromisso } from "@/components/forms/agenda";
import {
  COR_STATUS_COMPROMISSO, ROTULO_HISTORICO_COMPROMISSO, ROTULO_STATUS_COMPROMISSO, ROTULO_TIPO_COMPROMISSO, ROTULO_TIPO_VINCULO,
  STATUS_OCUPA_AGENDA, formatarPeriodo,
} from "@/lib/agenda";
import { carregarCompromisso } from "../carregar";

export const metadata: Metadata = { title: "Compromisso" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

export default async function CompromissoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, { criado }] = await Promise.all([params, searchParams]);
  const c = await carregarCompromisso(ator, id);
  const [alvos, choques] = await Promise.all([
    c.podeEditar ? opcoesAlvos(prisma) : Promise.resolve(null),
    STATUS_OCUPA_AGENDA.includes(c.status)
      ? buscarChoques(prisma, ator, { inicio: c.inicio, fim: c.fim, responsavelId: c.responsavelId, participantes: c.participantes.map((p) => p.usuarioId), agendaVereador: c.agendaVereador }, c.id)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Link href="/agenda" className="text-sm text-slate-600 hover:underline">← Agenda</Link>
      <CabecalhoPagina
        titulo={c.titulo}
        descricao={`${ROTULO_TIPO_COMPROMISSO[c.tipo]} · ${formatarPeriodo(c.inicio, c.fim)}`}
        acoes={c.podeEditar ? <Link href={`/agenda/${c.id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {criado && <div className="mb-4"><Aviso tipo="ok">Compromisso cadastrado.</Aviso></div>}
      {choques.length > 0 && (
        <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Choque de horário com:</p>
          <ul className="mt-1 space-y-1">
            {choques.map((x) => (
              <li key={x.id}>
                <Link href={`/agenda/${x.id}`} className="font-medium text-marca-800 underline">{x.titulo}</Link> — {x.periodo}
                {x.pessoas.length > 0 && <> · {x.pessoas.join(", ")}</>}{x.agendaVereador && <> · agenda do vereador</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <div className="mb-4 flex flex-wrap gap-2">
              <Selo cor={COR_STATUS_COMPROMISSO[c.status]}>{ROTULO_STATUS_COMPROMISSO[c.status]}</Selo>
              {c.agendaVereador && <Selo cor="azul">Agenda do vereador</Selo>}
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item rotulo="Local">{c.local}</Item>
              <Item rotulo="Bairro / regional">{c.bairro ? `${c.bairro.nome} · ${c.bairro.regional.nome}` : null}</Item>
              <Item rotulo="Responsável">{c.responsavel?.nome}</Item>
              <Item rotulo="Participantes internos">{c.participantes.map((p) => p.usuario.nome).join(", ")}</Item>
              <Item rotulo="Cadastrado por">{c.criadoPor?.nome}</Item>
            </dl>
            {c.pauta && (
              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase text-slate-500">Pauta</h3>
                <p className="mt-1 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">{c.pauta}</p>
              </div>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Resultado e encaminhamentos</h2>
            {c.resultado ? (
              <div className="space-y-3 text-sm">
                <p className="whitespace-pre-line text-slate-800">{c.resultado}</p>
                {c.encaminhamentos && (
                  <div>
                    <h3 className="text-xs font-medium uppercase text-slate-500">Encaminhamentos</h3>
                    <p className="mt-1 whitespace-pre-line text-slate-800">{c.encaminhamentos}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{c.status === "REALIZADO" ? "Ainda não registrado." : "Registre depois de marcar como realizado."}</p>
            )}
            {c.podeRegistrar && c.status === "REALIZADO" && (
              <details className="mt-4" open={!c.resultado}>
                <summary className="cursor-pointer text-sm font-medium text-marca-800">{c.resultado ? "Editar resultado" : "Registrar resultado"}</summary>
                <div className="mt-3">
                  <FormResultado acao={resultadoCompromissoAction.bind(null, c.id)} valores={{ resultado: c.resultado ?? "", encaminhamentos: c.encaminhamentos ?? "" }} />
                </div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Vínculos</h2>
            {c.alvos.length === 0 && <p className="text-sm text-slate-500">Nenhum vínculo.</p>}
            <ul className="divide-y divide-slate-100">
              {c.alvos.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Selo>{ROTULO_TIPO_VINCULO[a.tipo]}</Selo>
                  <Link href={a.href} className="font-medium text-marca-800 hover:underline">{a.rotulo}</Link>
                  {c.podeEditar && (
                    <span className="ml-auto"><BotaoConfirmar acao={desvincularCompromissoAction.bind(null, c.id, a.id)} rotulo="Remover" pergunta="Remover este vínculo?" /></span>
                  )}
                </li>
              ))}
            </ul>
            {c.podeEditar && alvos && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Vincular demanda, emenda, entidade, parlamentar ou mandato</summary>
                <div className="mt-3"><FormVinculoCompromisso acao={vincularCompromissoAction.bind(null, c.id)} alvos={alvos} /></div>
              </details>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          {c.podeEditar && (
            <Cartao>
              <h2 className="mb-3 text-base font-semibold">Status</h2>
              <FormStatusCompromisso acao={statusCompromissoAction.bind(null, c.id)} atual={c.status} podeConfirmar={c.podeConfirmar} />
            </Cartao>
          )}
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico</h2>
            {c.podeRegistrar && <div className="mb-4"><FormComentarioCompromisso acao={comentarCompromissoAction.bind(null, c.id)} /></div>}
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {c.historico.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-xs text-slate-500">{fmt.format(h.data)} · {h.usuario?.nome ?? "Sistema"} · {ROTULO_HISTORICO_COMPROMISSO[h.tipo]}</p>
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

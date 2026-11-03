import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { rotuloMandato } from "@/server/services/parlamentares";
import { atualizarMandatoAction, criarMandatoAction, excluirMandatoAction } from "@/server/services/parlamentares-actions";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { BotaoConfirmar, FormMandato } from "@/components/forms/parlamentar";
import { COR_STATUS, ROTULO_STATUS, dataISO } from "@/lib/demandas";
import { ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO, ROTULO_SITUACAO, situacaoMandato } from "@/lib/parlamentares";
import { carregarParlamentar } from "../carregar";

export const metadata: Metadata = { title: "Parlamentar" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

export default async function ParlamentarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, { criado }] = await Promise.all([params, searchParams]);
  const p = await carregarParlamentar(ator, id);
  const s = (v: string | null) => v ?? "";

  return (
    <>
      <Link href="/parlamentares" className="text-sm text-slate-600 hover:underline">← Parlamentares</Link>
      <CabecalhoPagina
        titulo={p.nome}
        descricao={`${ROTULO_CARGO[p.cargo]}${p.partido ? ` · ${p.partido}` : ""} · ${ROTULO_ESFERA[p.esfera]}`}
        acoes={p.podeEditar ? <Link href={`/parlamentares/${p.id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {criado && <div className="mb-4"><Aviso tipo="ok">Parlamentar cadastrado. Agora cadastre os mandatos.</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <div className="mb-4 flex flex-wrap gap-2">
              {p.proprio && <Selo cor="azul">Mandato próprio</Selo>}
              <Selo cor={p.ativo ? "verde" : "cinza"}>{p.ativo ? "Ativo" : "Inativo"}</Selo>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item rotulo="Município / UF">{[p.municipio, p.uf].filter(Boolean).join(" / ")}</Item>
              <Item rotulo="Telefone">{p.telefone}</Item>
              <Item rotulo="E-mail">{p.email}</Item>
              <Item rotulo="Cadastrado por">{p.criadoPor?.nome}</Item>
            </dl>
            {p.observacoes && <p className="mt-4 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">{p.observacoes}</p>}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Mandatos</h2>
            {p.mandatos.length === 0 && <p className="text-sm text-slate-500">Nenhum mandato cadastrado.</p>}
            <ul className="space-y-3">
              {p.mandatos.map((m) => {
                const sit = ROTULO_SITUACAO[situacaoMandato(m.dataInicio, m.dataFim)];
                const valores = {
                  cargo: m.cargo, esfera: m.cargo === "OUTRO" ? m.esfera : "", legislatura: s(m.legislatura), descricao: s(m.descricao), partido: s(m.partido),
                  municipio: s(m.municipio), uf: s(m.uf), dataInicio: dataISO(m.dataInicio), dataFim: m.dataFim ? dataISO(m.dataFim) : "", observacoes: s(m.observacoes),
                };
                return (
                  <li key={m.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{ROTULO_CARGO[m.cargo]}</strong>
                      <span className="text-slate-600">{rotuloMandato(m)}</span>
                      <Selo cor={sit.cor}>{sit.texto}</Selo>
                      {m.partido && <Selo>{m.partido}</Selo>}
                      <span className="text-xs text-slate-500">{m._count.demandas} demanda(s) vinculada(s)</span>
                    </div>
                    <p className="mt-1 text-slate-600">{[ROTULO_ESFERA[m.esfera], [m.municipio, m.uf].filter(Boolean).join("/"), m.descricao].filter(Boolean).join(" · ")}</p>
                    {m.observacoes && <p className="mt-1 text-slate-600">{m.observacoes}</p>}
                    {p.podeEditar && (
                      <div className="mt-2 flex flex-wrap items-start gap-4">
                        <details className="flex-1">
                          <summary className="cursor-pointer text-xs font-medium text-marca-800">Editar mandato</summary>
                          <div className="mt-3">
                            <FormMandato acao={atualizarMandatoAction.bind(null, p.id, m.id)} valores={valores} rotuloBotao="Salvar mandato" prefixo={`m${m.id.slice(0, 8)}-`} />
                          </div>
                        </details>
                        {m._count.demandas === 0 && (
                          <BotaoConfirmar acao={excluirMandatoAction.bind(null, p.id, m.id)} rotulo="Excluir mandato" pergunta="Excluir este mandato?" />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {p.podeEditar && (
              <details className="mt-4" open={p.mandatos.length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Adicionar mandato</summary>
                <div className="mt-3"><FormMandato acao={criarMandatoAction.bind(null, p.id)} valores={{ cargo: p.cargo }} rotuloBotao="Cadastrar mandato" /></div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Demandas articuladas</h2>
            {p.proprio && <p className="mb-2 text-sm text-slate-500">Todas as demandas do sistema já são do mandato próprio; aqui aparecem só vínculos com parceiros.</p>}
            {p.vinculos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma demanda vinculada.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {p.vinculos.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/demandas/${v.demanda.id}`} className="font-medium text-marca-800 hover:underline">{v.demanda.protocolo}</Link>
                      <Selo cor={COR_STATUS[v.demanda.status]}>{ROTULO_STATUS[v.demanda.status]}</Selo>
                      <Selo cor="azul">{ROTULO_PARTICIPACAO[v.tipo]}</Selo>
                      <span className="text-xs text-slate-500">{v.demanda.tema.nome} · mandato {rotuloMandato(v.mandato)}</span>
                    </div>
                    <p className="line-clamp-2 text-slate-600">{v.demanda.descricao}</p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico</h2>
            {p.historico.length === 0 && <p className="text-sm text-slate-500">Sem registros.</p>}
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {p.historico.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-xs text-slate-500">{fmt.format(h.data)} · {h.usuario?.nome ?? "Sistema"}</p>
                  <p className="text-slate-800">{h.descricao ?? `${h.acao} ${h.entidade}`}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}

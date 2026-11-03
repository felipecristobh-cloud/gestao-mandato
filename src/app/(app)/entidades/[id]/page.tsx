import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { compromissosVinculados } from "@/server/services/agenda";
import { opcoesMandatosEntidade } from "@/server/services/entidades";
import { desvincularMandatoEntidadeAction, vincularMandatoEntidadeAction } from "@/server/services/entidades-actions";
import { rotuloMandato } from "@/server/services/parlamentares";
import { Aviso, CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import { BotaoConfirmar } from "@/components/forms/parlamentar";
import { FormVinculoEntidade } from "@/components/forms/entidade";
import { CompromissosVinculados } from "@/components/agenda/compromissos-vinculados";
import { COR_STATUS, ROTULO_STATUS } from "@/lib/demandas";
import { COR_STATUS_EMENDA, ROTULO_STATUS_EMENDA, centavos, formatarCnpj, formatarMoeda } from "@/lib/emendas";
import { ROTULO_TIPO_ENTIDADE } from "@/lib/entidades";
import { ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO } from "@/lib/parlamentares";
import { carregarEntidade } from "../carregar";

export const metadata: Metadata = { title: "Entidade" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

export default async function EntidadePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const [{ id }, { criada }] = await Promise.all([params, searchParams]);
  const e = await carregarEntidade(ator, id);
  const [compromissos, mandatos] = await Promise.all([
    compromissosVinculados(prisma, ator, { tipo: "entidade", id: e.id }),
    e.podeEditar ? opcoesMandatosEntidade(prisma) : Promise.resolve([]),
  ]);
  const criar = pode(ator, "dados:criar");

  return (
    <>
      <Link href="/entidades" className="text-sm text-slate-600 hover:underline">← Entidades</Link>
      <CabecalhoPagina
        titulo={e.nome}
        descricao={`${ROTULO_TIPO_ENTIDADE[e.tipo]}${e.tema ? ` · ${e.tema.nome}` : ""}${e.cnpj ? ` · CNPJ ${formatarCnpj(e.cnpj)}` : ""}`}
        acoes={e.podeEditar ? <Link href={`/entidades/${e.id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      {criada && <div className="mb-4"><Aviso tipo="ok">Entidade cadastrada.</Aviso></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <div className="mb-4 flex flex-wrap gap-2">
              <Selo cor={e.ativo ? "verde" : "cinza"}>{e.ativo ? "Ativa" : "Inativa"}</Selo>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item rotulo="Responsável">{e.responsavel}</Item>
              <Item rotulo="Telefone">{e.telefone}</Item>
              <Item rotulo="E-mail">{e.email}</Item>
              <Item rotulo="Endereço">{e.endereco}</Item>
              <Item rotulo="Bairro / regional">{e.bairro ? `${e.bairro.nome} · ${e.bairro.regional.nome}` : null}</Item>
              <Item rotulo="Cadastrada por">{e.criadoPor?.nome}</Item>
            </dl>
            {!e.contatoVisivel && <p className="mt-3 text-xs text-slate-500">Contatos mascarados para o perfil Consulta.</p>}
            {e.observacoes && <p className="mt-4 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">{e.observacoes}</p>}
          </Cartao>

          <Cartao>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Demandas</h2>
              {criar && <Link href={`/demandas/nova?entidade=${e.id}`} className="text-sm font-medium text-marca-800 hover:underline">+ Nova demanda</Link>}
            </div>
            {e.demandas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma demanda vinculada.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {e.demandas.map((d) => (
                  <li key={d.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/demandas/${d.id}`} className="font-medium text-marca-800 hover:underline">{d.protocolo}</Link>
                      <Selo cor={COR_STATUS[d.status]}>{ROTULO_STATUS[d.status]}</Selo>
                      <span className="text-xs text-slate-500">{d.tema.nome}</span>
                    </div>
                    <p className="line-clamp-2 text-slate-600">{d.descricao}</p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Emendas (como beneficiária)</h2>
            {e.emendas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma emenda vinculada. Na emenda, escolha esta entidade em “Beneficiário”.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {e.emendas.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/emendas/${m.id}`} className="font-medium text-marca-800 hover:underline">{m.codigo}</Link>
                      <Selo cor={COR_STATUS_EMENDA[m.status]}>{ROTULO_STATUS_EMENDA[m.status]}</Selo>
                      <span className="text-xs text-slate-500">
                        {ROTULO_ESFERA[m.esfera]} · {m.numero ? `nº ${m.numero}/${m.ano}` : m.ano} · {formatarMoeda(centavos(m.valorAprovado ?? m.valorIndicado))}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-slate-600">{m.objeto}</p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <CompromissosVinculados itens={compromissos} novoHref={criar ? `/agenda/nova?vinculo=entidade:${e.id}` : undefined} titulo="Reuniões e agenda" />
        </div>

        <div className="space-y-6">
          <Cartao>
            <h2 className="mb-1 text-base font-semibold">Mandatos</h2>
            <p className="mb-3 text-xs text-slate-500">Parceria, articulação, acompanhamento… Autoria só existe em emendas.</p>
            {e.mandatos.length === 0 && <p className="text-sm text-slate-500">Nenhum mandato vinculado.</p>}
            <ul className="space-y-2">
              {e.mandatos.map((v) => (
                <li key={v.id} className="rounded-md border border-slate-200 p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/parlamentares/${v.mandato.parlamentar.id}`} className="font-medium text-marca-800 hover:underline">{v.mandato.parlamentar.nome}</Link>
                    <Selo cor="azul">{ROTULO_PARTICIPACAO[v.tipo]}</Selo>
                    {v.mandato.parlamentar.proprio && <Selo>Mandato próprio</Selo>}
                  </div>
                  <p className="text-xs text-slate-500">{ROTULO_CARGO[v.mandato.cargo]} · {rotuloMandato(v.mandato)}{v.usuario ? ` · por ${v.usuario.nome}` : ""}</p>
                  {v.observacoes && <p className="mt-1 text-slate-600">{v.observacoes}</p>}
                  {e.podeEditar && (
                    <div className="mt-1"><BotaoConfirmar acao={desvincularMandatoEntidadeAction.bind(null, e.id, v.id)} rotulo="Remover" pergunta="Remover este vínculo?" /></div>
                  )}
                </li>
              ))}
            </ul>
            {e.podeEditar && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-marca-800">+ Vincular mandato</summary>
                <div className="mt-3"><FormVinculoEntidade acao={vincularMandatoEntidadeAction.bind(null, e.id)} opcoes={mandatos} /></div>
              </details>
            )}
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-base font-semibold">Histórico</h2>
            {e.historico.length === 0 && <p className="text-sm text-slate-500">Sem registros.</p>}
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {e.historico.map((h) => (
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

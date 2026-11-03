import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { redeMandatos, type ItemRede } from "@/server/services/emendas";
import { CabecalhoPagina, Cartao, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { COR_STATUS_EMENDA, ROTULO_STATUS_EMENDA, STATUS_EMENDA, formatarMoeda } from "@/lib/emendas";
import { ESFERAS, ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO } from "@/lib/parlamentares";

export const metadata: Metadata = { title: "Rede de Mandatos" };

function Emenda({ e, parceiro }: { e: ItemRede; parceiro?: boolean }) {
  return (
    <li className="rounded-md border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/emendas/${e.id}`} className="font-medium text-marca-800 hover:underline">{e.codigo}</Link>
        <span className="text-xs text-slate-500">{e.numero ? `nº ${e.numero}/${e.ano}` : e.ano} · {ROTULO_ESFERA[e.esfera]}</span>
        <Selo cor={COR_STATUS_EMENDA[e.status]}>{ROTULO_STATUS_EMENDA[e.status]}</Selo>
        <span className="ml-auto tabular-nums font-medium">{formatarMoeda(e.valor)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-slate-700">{e.objeto}</p>
      <p className="mt-1 text-xs text-slate-600">
        <span className="font-medium">Órgão:</span> {e.orgao ?? "—"} <span aria-hidden>→</span> <span className="font-medium">Beneficiário:</span> {e.beneficiario ?? "—"}
      </p>
      <p className="mt-1 flex flex-wrap gap-1 text-xs">
        <span className="text-slate-500">Mandato próprio:</span>
        {e.tiposProprio.map((t) => <Selo key={t} cor={t === "AUTOR" || t === "COAUTOR" ? "verde" : "azul"}>{ROTULO_PARTICIPACAO[t]}</Selo>)}
        {parceiro && (
          <>
            <span className="ml-2 text-slate-500">Parceiro:</span>
            {e.tiposParceiro.map((t) => <Selo key={t} cor={t === "AUTOR" || t === "COAUTOR" ? "verde" : "azul"}>{ROTULO_PARTICIPACAO[t]}</Selo>)}
          </>
        )}
      </p>
    </li>
  );
}

export default async function RedePage({ searchParams }: { searchParams: Promise<{ esfera?: string; status?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const rede = await redeMandatos(prisma, ator, sp);
  const filtrando = Boolean(sp.esfera || sp.status);

  return (
    <>
      <Link href="/emendas" className="text-sm text-slate-600 hover:underline">← Emendas</Link>
      <CabecalhoPagina
        titulo="Rede de Mandatos"
        descricao="Mandato próprio → parlamentar parceiro → emenda → órgão → beneficiário. Só entram emendas com vínculo cadastrado do mandato próprio."
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Rotulo htmlFor="r-esfera">Esfera</Rotulo>
            <Selecao id="r-esfera" name="esfera" defaultValue={sp.esfera ?? ""}>
              <option value="">Todas</option>
              {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="r-status">Status</Rotulo>
            <Selecao id="r-status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos</option>
              <option value="andamento">Em andamento</option>
              {STATUS_EMENDA.map((s) => <option key={s} value={s}>{ROTULO_STATUS_EMENDA[s]}</option>)}
            </Selecao>
          </div>
          <div className="flex items-end gap-2">
            {filtrando && <Link href="/emendas/rede" className={classeBotao("fantasma")}>Limpar</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      {!rede.proprio ? (
        <Cartao><p className="text-sm text-slate-600">Nenhum parlamentar marcado como mandato próprio. Marque em Parlamentares e Mandatos.</p></Cartao>
      ) : (
        <>
          <Cartao className="mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/parlamentares/${rede.proprio.id}`} className="text-lg font-semibold text-marca-800 hover:underline">{rede.proprio.nome}</Link>
              <Selo cor="azul">Mandato próprio</Selo>
              <span className="text-sm text-slate-600">{ROTULO_CARGO[rede.proprio.cargo]}{rede.proprio.partido ? ` · ${rede.proprio.partido}` : ""}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div><dt className="text-xs uppercase text-slate-500">Emendas</dt><dd className="font-semibold">{rede.totais.emendas}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Valor</dt><dd className="font-semibold tabular-nums">{formatarMoeda(rede.totais.valor)}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Pago</dt><dd className="font-semibold tabular-nums">{formatarMoeda(rede.totais.pago)}</dd></div>
              {ESFERAS.filter((e) => rede.totais.porEsfera[e]).map((e) => (
                <div key={e}>
                  <dt className="text-xs uppercase text-slate-500">{ROTULO_ESFERA[e]}</dt>
                  <dd className="text-sm tabular-nums">{rede.totais.porEsfera[e]!.emendas} · {formatarMoeda(rede.totais.porEsfera[e]!.valor)}</dd>
                </div>
              ))}
            </dl>
          </Cartao>

          {rede.grupos.length === 0 && rede.semParceiro.length === 0 && (
            <Cartao><p className="text-sm text-slate-500">Nenhuma emenda com vínculo do mandato próprio.</p></Cartao>
          )}

          <ul className="space-y-4 border-l-2 border-marca-200 pl-4">
            {rede.grupos.map((g) => (
              <li key={g.parlamentar.id}>
                <Cartao>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Link href={`/parlamentares/${g.parlamentar.id}`} className="font-semibold text-marca-800 hover:underline">{g.parlamentar.nome}</Link>
                    <span className="text-xs text-slate-500">{ROTULO_CARGO[g.parlamentar.cargo]}{g.parlamentar.partido ? ` · ${g.parlamentar.partido}` : ""}</span>
                    {g.tipos.map((t) => <Selo key={t}>{ROTULO_PARTICIPACAO[t]}</Selo>)}
                    <span className="ml-auto text-sm tabular-nums text-slate-700">{g.emendas.length} emenda(s) · {formatarMoeda(g.valor)}</span>
                  </div>
                  <ul className="space-y-2 border-l border-slate-200 pl-3">
                    {g.emendas.map((e) => <Emenda key={e.id} e={e} parceiro />)}
                  </ul>
                </Cartao>
              </li>
            ))}
            {rede.semParceiro.length > 0 && (
              <li>
                <Cartao>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Sem parceiro vinculado</span>
                    <span className="ml-auto text-sm text-slate-700">{rede.semParceiro.length} emenda(s)</span>
                  </div>
                  <ul className="space-y-2 border-l border-slate-200 pl-3">
                    {rede.semParceiro.map((e) => <Emenda key={e.id} e={e} />)}
                  </ul>
                </Cartao>
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Uma emenda com mais de um parceiro aparece em cada um deles; os totais do topo contam cada emenda uma vez.</p>
        </>
      )}
    </>
  );
}

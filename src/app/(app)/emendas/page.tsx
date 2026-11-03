import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { anosEmendas, listarEmendas } from "@/server/services/emendas";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { COR_STATUS_EMENDA, ROTULO_STATUS_EMENDA, ROTULO_TIPO_EMENDA, STATUS_EMENDA, formatarMoeda, resumoFinanceiro } from "@/lib/emendas";
import { ESFERAS, ROTULO_ESFERA } from "@/lib/parlamentares";

export const metadata: Metadata = { title: "Emendas" };

type Busca = Record<string, string | undefined>;

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={destaque ? "rounded-lg bg-marca-50 p-3" : "rounded-lg bg-slate-50 p-3"}>
      <p className="text-xs font-medium uppercase text-slate-500">{rotulo}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatarMoeda(valor)}</p>
    </div>
  );
}

export default async function EmendasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const [lista, anos, parlamentares] = await Promise.all([
    listarEmendas(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 }),
    anosEmendas(prisma),
    prisma.parlamentar.findMany({ where: { mandatos: { some: { emendas: { some: {} } } } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  const link = (extra: Busca) => `/emendas?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);
  const t = lista.totais;

  return (
    <>
      <CabecalhoPagina
        titulo="Emendas"
        descricao={`${lista.total} emenda${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros escolhidos" : ""}`}
        acoes={
          <div className="flex flex-wrap gap-2">
            <Link href="/emendas/rede" className={classeBotao("secundario")}>Rede de Mandatos</Link>
            {pode(ator, "dados:criar") && <Link href="/emendas/nova" className={classeBotao()}>+ Nova emenda</Link>}
          </div>
        }
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Código, número, objeto ou beneficiário" />
          </div>
          <div>
            <Rotulo htmlFor="f-esfera">Esfera</Rotulo>
            <Selecao id="f-esfera" name="esfera" defaultValue={sp.esfera ?? ""}>
              <option value="">Todas</option>
              {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-status">Status</Rotulo>
            <Selecao id="f-status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos</option>
              <option value="andamento">Em andamento</option>
              {STATUS_EMENDA.map((s) => <option key={s} value={s}>{ROTULO_STATUS_EMENDA[s]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-ano">Ano</Rotulo>
            <Selecao id="f-ano" name="ano" defaultValue={sp.ano ?? ""}>
              <option value="">Todos</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-resp">Responsável</Rotulo>
            <Selecao id="f-resp" name="responsavel" defaultValue={sp.responsavel ?? ""}>
              <option value="">Todos</option>
              <option value="eu">Minhas</option>
              <option value="sem">Sem responsável</option>
            </Selecao>
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="f-parl">Parlamentar envolvido</Rotulo>
            <Selecao id="f-parl" name="parlamentarId" defaultValue={sp.parlamentarId ?? ""}>
              <option value="">Todos</option>
              {parlamentares.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {filtrando && <Link href="/emendas" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <section aria-label="Totais" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Total rotulo="Indicado" valor={t.indicado} />
        <Total rotulo="Aprovado" valor={t.aprovado} />
        <Total rotulo="Empenhado" valor={t.empenhado} />
        <Total rotulo="Liquidado" valor={t.liquidado} />
        <Total rotulo="Pago" valor={t.pago} />
        <Total rotulo="Saldo a pagar" valor={t.saldo} destaque />
      </section>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Lista de emendas</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Emenda</th>
              <th scope="col" className="px-4 py-3">Objeto / beneficiário</th>
              <th scope="col" className="px-4 py-3">Autor</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Valor</th>
              <th scope="col" className="px-4 py-3 text-right">Pago</th>
              <th scope="col" className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhuma emenda encontrada.</td></tr>
            )}
            {lista.itens.map((e) => {
              const r = resumoFinanceiro(e.valores);
              return (
                <tr key={e.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/emendas/${e.id}`} className="font-medium text-marca-800 hover:underline">{e.codigo}</Link>
                    <p className="text-xs text-slate-500">{e.numero ? `Nº ${e.numero}/${e.ano}` : `Sem número · ${e.ano}`}</p>
                    <p className="text-xs text-slate-500">{ROTULO_ESFERA[e.esfera]} · {ROTULO_TIPO_EMENDA[e.tipo]}</p>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <p className="line-clamp-2 text-slate-800">{e.objeto}</p>
                    <p className="text-xs text-slate-500">{[e.beneficiario, e.orgao?.sigla ?? e.orgao?.nome].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {e.autor ? <Link href={`/parlamentares/${e.autor.id}`} className="hover:underline">{e.autor.nome}</Link> : <span className="text-slate-500">Não informado</span>}
                  </td>
                  <td className="px-4 py-3"><Selo cor={COR_STATUS_EMENDA[e.status]}>{ROTULO_STATUS_EMENDA[e.status]}</Selo></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatarMoeda(r.base)}
                    <p className="text-xs text-slate-500">{e.valores.aprovado === null ? "indicado" : "aprovado"}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatarMoeda(e.valores.pago)}<p className="text-xs text-slate-500">{r.percentualPago}%</p></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatarMoeda(r.saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Cartao>

      {lista.paginas > 1 && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
          {lista.pagina > 1 ? <Link className={classeBotao("secundario")} href={link({ ...sp, pagina: String(lista.pagina - 1) })}>← Anterior</Link> : <span />}
          <span className="text-slate-600">Página {lista.pagina} de {lista.paginas}</span>
          {lista.pagina < lista.paginas ? <Link className={classeBotao("secundario")} href={link({ ...sp, pagina: String(lista.pagina + 1) })}>Próxima →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

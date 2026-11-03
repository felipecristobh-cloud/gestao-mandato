import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarParlamentares, rotuloMandato } from "@/server/services/parlamentares";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { CARGOS, ESFERAS, ROTULO_CARGO, ROTULO_ESFERA } from "@/lib/parlamentares";

export const metadata: Metadata = { title: "Parlamentares e Mandatos" };

type Busca = Record<string, string | undefined>;

export default async function ParlamentaresPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const lista = await listarParlamentares(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 });
  const link = (extra: Busca) => `/parlamentares?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <>
      <CabecalhoPagina
        titulo="Parlamentares e Mandatos"
        descricao={`${lista.total} parlamentar${lista.total === 1 ? "" : "es"}${filtrando ? " com os filtros escolhidos" : ""}`}
        acoes={pode(ator, "dados:criar") ? <Link href="/parlamentares/novo" className={classeBotao()}>+ Novo parlamentar</Link> : undefined}
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Nome, partido ou município" />
          </div>
          <div>
            <Rotulo htmlFor="f-cargo">Cargo</Rotulo>
            <Selecao id="f-cargo" name="cargo" defaultValue={sp.cargo ?? ""}>
              <option value="">Todos</option>
              {CARGOS.map((c) => <option key={c} value={c}>{ROTULO_CARGO[c]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-esfera">Esfera</Rotulo>
            <Selecao id="f-esfera" name="esfera" defaultValue={sp.esfera ?? ""}>
              <option value="">Todas</option>
              {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-situacao">Situação</Rotulo>
            <Selecao id="f-situacao" name="situacao" defaultValue={sp.situacao ?? ""}>
              <option value="">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
            {filtrando && <Link href="/parlamentares" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Lista de parlamentares</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">Cargo</th>
              <th scope="col" className="px-4 py-3">Partido</th>
              <th scope="col" className="px-4 py-3">Município / UF</th>
              <th scope="col" className="px-4 py-3">Mandato vigente</th>
              <th scope="col" className="px-4 py-3 text-right">Demandas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum parlamentar encontrado.</td></tr>
            )}
            {lista.itens.map((p) => (
              <tr key={p.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/parlamentares/${p.id}`} className="font-medium text-marca-800 hover:underline">{p.nome}</Link>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {p.proprio && <Selo cor="azul">Mandato próprio</Selo>}
                    {!p.ativo && <Selo>Inativo</Selo>}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">{ROTULO_CARGO[p.cargo]}<p className="text-xs text-slate-500">{ROTULO_ESFERA[p.esfera]}</p></td>
                <td className="px-4 py-3 text-slate-700">{p.partido ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{[p.municipio, p.uf].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-4 py-3 text-slate-700">
                  {p.vigente ? rotuloMandato(p.vigente) : <span className="text-slate-500">Nenhum{p.mandatos.length ? ` (${p.mandatos.length} no histórico)` : ""}</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{p.vinculos}</td>
              </tr>
            ))}
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

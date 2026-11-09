import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarOportunidades, opcoesFormOportunidade } from "@/server/services/oportunidades";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { COR_PRIORIDADE_OPORTUNIDADE, PRIORIDADES_OPORTUNIDADE, ROTULO_PRIORIDADE_OPORTUNIDADE } from "@/lib/oportunidades";

export const metadata: Metadata = { title: "Oportunidades Legislativas" };

type Busca = Record<string, string | undefined>;

export default async function OportunidadesPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const [lista, opcoes] = await Promise.all([listarOportunidades(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 }), opcoesFormOportunidade(prisma)]);
  const link = (extra: Busca) => `/oportunidades?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <>
      <CabecalhoPagina
        titulo="Oportunidades Legislativas"
        descricao={`${lista.total} proposta${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros escolhidos" : ""} · ordenadas pela nota de impacto`}
        acoes={
          <>
            {pode(ator, "cadastros_base:gerenciar") && <Link href="/oportunidades/eixos" className={classeBotao("secundario")}>Eixos temáticos</Link>}
            {pode(ator, "dados:criar") && <Link href="/oportunidades/nova" className={classeBotao()}>+ Nova oportunidade</Link>}
          </>
        }
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Nome, problema ou público" />
          </div>
          <div>
            <Rotulo htmlFor="f-eixo">Eixo</Rotulo>
            <Selecao id="f-eixo" name="eixo" defaultValue={sp.eixo ?? ""}>
              <option value="">Todos</option>
              {opcoes.eixos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-prioridade">Prioridade</Rotulo>
            <Selecao id="f-prioridade" name="prioridade" defaultValue={sp.prioridade ?? ""}>
              <option value="">Todas</option>
              {PRIORIDADES_OPORTUNIDADE.map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE_OPORTUNIDADE[p]}</option>)}
              <option value="SEM">Sem avaliação</option>
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-regional">Regional</Rotulo>
            <Selecao id="f-regional" name="regional" defaultValue={sp.regional ?? ""}>
              <option value="">Todas</option>
              {opcoes.regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-responsavel">Responsável</Rotulo>
            <Selecao id="f-responsavel" name="responsavel" defaultValue={sp.responsavel ?? ""}>
              <option value="">Todos</option>
              <option value="nenhum">Sem responsável</option>
              {opcoes.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
            {filtrando && <Link href="/oportunidades" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Lista de oportunidades legislativas</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Proposta</th>
              <th scope="col" className="px-4 py-3">Eixo</th>
              <th scope="col" className="px-4 py-3">Regionais</th>
              <th scope="col" className="px-4 py-3">Responsável</th>
              <th scope="col" className="px-4 py-3 text-right">Nota</th>
              <th scope="col" className="px-4 py-3">Prioridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma oportunidade encontrada.</td></tr>
            )}
            {lista.itens.map((o) => (
              <tr key={o.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/oportunidades/${o.id}`} className="font-medium text-marca-800 hover:underline">{o.nome}</Link>
                  <p className="line-clamp-2 text-xs text-slate-500">{o.problema}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{o.eixo.nome}</td>
                <td className="px-4 py-3 text-slate-700">{o.regionais.map((r) => r.regional.nome).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{o.responsavel?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{o.notaFinal ?? "—"}</td>
                <td className="px-4 py-3">
                  {o.prioridade ? <Selo cor={COR_PRIORIDADE_OPORTUNIDADE[o.prioridade]}>{ROTULO_PRIORIDADE_OPORTUNIDADE[o.prioridade]}</Selo> : <Selo>Sem avaliação</Selo>}
                  {o.prioridadeManual && <p className="mt-1 text-xs text-slate-500">definida manualmente</p>}
                </td>
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

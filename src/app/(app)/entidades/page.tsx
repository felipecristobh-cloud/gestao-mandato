import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarEntidades, opcoesFormEntidade } from "@/server/services/entidades";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { formatarCnpj } from "@/lib/emendas";
import { ROTULO_TIPO_ENTIDADE, TIPOS_ENTIDADE } from "@/lib/entidades";

export const metadata: Metadata = { title: "Entidades" };

type Busca = Record<string, string | undefined>;

export default async function EntidadesPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const [lista, opcoes] = await Promise.all([listarEntidades(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 }), opcoesFormEntidade(prisma)]);
  const link = (extra: Busca) => `/entidades?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <>
      <CabecalhoPagina
        titulo="Entidades"
        descricao={`${lista.total} entidade${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros escolhidos" : ""}`}
        acoes={pode(ator, "dados:criar") ? <Link href="/entidades/nova" className={classeBotao()}>+ Nova entidade</Link> : undefined}
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Nome, CNPJ ou responsável" />
          </div>
          <div>
            <Rotulo htmlFor="f-tipo">Tipo</Rotulo>
            <Selecao id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos</option>
              {TIPOS_ENTIDADE.map((t) => <option key={t} value={t}>{ROTULO_TIPO_ENTIDADE[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-tema">Área</Rotulo>
            <Selecao id="f-tema" name="temaId" defaultValue={sp.temaId ?? ""}>
              <option value="">Todas</option>
              {opcoes.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
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
            <Rotulo htmlFor="f-situacao">Situação</Rotulo>
            <Selecao id="f-situacao" name="situacao" defaultValue={sp.situacao ?? ""}>
              <option value="">Ativas</option>
              <option value="inativas">Inativas</option>
              <option value="todas">Todas</option>
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
            {filtrando && <Link href="/entidades" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Lista de entidades</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">Tipo / área</th>
              <th scope="col" className="px-4 py-3">Bairro / regional</th>
              <th scope="col" className="px-4 py-3 text-right">Demandas</th>
              <th scope="col" className="px-4 py-3 text-right">Emendas</th>
              <th scope="col" className="px-4 py-3 text-right">Agenda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma entidade encontrada.</td></tr>
            )}
            {lista.itens.map((e) => (
              <tr key={e.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/entidades/${e.id}`} className="font-medium text-marca-800 hover:underline">{e.nome}</Link>
                  <p className="text-xs text-slate-500">{[e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : null, e.responsavel].filter(Boolean).join(" · ")}</p>
                  {!e.ativo && <p className="mt-1"><Selo>Inativa</Selo></p>}
                </td>
                <td className="px-4 py-3 text-slate-700">{ROTULO_TIPO_ENTIDADE[e.tipo]}<p className="text-xs text-slate-500">{e.tema?.nome}</p></td>
                <td className="px-4 py-3 text-slate-700">{e.bairro ? `${e.bairro.nome} · ${e.bairro.regional.nome}` : "—"}</td>
                <td className="px-4 py-3 text-right text-slate-700">{e._count.demandas}</td>
                <td className="px-4 py-3 text-right text-slate-700">{e._count.emendas}</td>
                <td className="px-4 py-3 text-right text-slate-700">{e._count.compromissos}</td>
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

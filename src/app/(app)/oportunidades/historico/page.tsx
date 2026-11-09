import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarProposicoes, opcoesProposicao } from "@/server/services/proposicoes";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import {
  ANO_MAX, ANO_MIN, COR_VERIFICACAO, MANDATOS_PEDRO, PARTICIPACOES, ROTULO_PARTICIPACAO_PROPOSICAO, ROTULO_TIPO_PROPOSICAO, ROTULO_VERIFICACAO,
  TIPOS_PROPOSICAO, VERIFICACOES, rotuloMandatoPedro, rotuloProposicao,
} from "@/lib/proposicoes";

export const metadata: Metadata = { title: "Histórico legislativo" };

type Busca = Record<string, string | undefined>;
const ANOS = Array.from({ length: ANO_MAX - ANO_MIN + 1 }, (_, i) => ANO_MAX - i);

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const [lista, eixos] = await Promise.all([listarProposicoes(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 }), opcoesProposicao(prisma)]);
  const link = (extra: Busca) => `/oportunidades/historico?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina
        titulo="Histórico legislativo"
        descricao={`Proposições de Pedro Patrus nos mandatos de ${ANO_MIN} a ${ANO_MAX}. ${lista.total} registro${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros" : ""}.`}
        acoes={pode(ator, "dados:criar") ? (
          <>
            <Link href="/oportunidades/historico/importar" className={classeBotao("secundario")}>Importar planilha</Link>
            <Link href="/oportunidades/historico/nova" className={classeBotao()}>+ Nova proposição</Link>
          </>
        ) : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lista.porMandato.map((m) => (
          <Link key={m.numero} href={link({ mandato: String(m.numero) })} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-marca-600">
            <p className="text-xs font-medium uppercase text-slate-500">{rotuloMandatoPedro(m)}</p>
            <p className="text-2xl font-semibold text-slate-900">{m.total}</p>
          </Link>
        ))}
      </div>

      <Cartao className="mb-4">
        <form key={new URLSearchParams(sp as Record<string, string>).toString()} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Ementa, descrição, lei ou número" />
          </div>
          <div>
            <Rotulo htmlFor="f-mandato">Mandato</Rotulo>
            <Selecao id="f-mandato" name="mandato" defaultValue={sp.mandato ?? ""}>
              <option value="">Todos</option>
              {MANDATOS_PEDRO.map((m) => <option key={m.numero} value={m.numero}>{rotuloMandatoPedro(m)}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-ano">Ano</Rotulo>
            <Selecao id="f-ano" name="ano" defaultValue={sp.ano ?? ""}>
              <option value="">Todos</option>
              {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-tipo">Tipo</Rotulo>
            <Selecao id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos</option>
              {TIPOS_PROPOSICAO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_PROPOSICAO[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-participacao">Autoria</Rotulo>
            <Selecao id="f-participacao" name="participacao" defaultValue={sp.participacao ?? ""}>
              <option value="">Todas</option>
              {PARTICIPACOES.map((p) => <option key={p} value={p}>{ROTULO_PARTICIPACAO_PROPOSICAO[p]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-eixo">Tema (eixo)</Rotulo>
            <Selecao id="f-eixo" name="eixo" defaultValue={sp.eixo ?? ""}>
              <option value="">Todos</option>
              <option value="nenhum">Sem eixo</option>
              {eixos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-verificacao">Verificação</Rotulo>
            <Selecao id="f-verificacao" name="verificacao" defaultValue={sp.verificacao ?? ""}>
              <option value="">Todas</option>
              {VERIFICACOES.map((v) => <option key={v} value={v}>{ROTULO_VERIFICACAO[v]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-situacao">Situação</Rotulo>
            <Campo id="f-situacao" name="situacao" defaultValue={sp.situacao} placeholder="Ex.: arquivada" />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            {filtrando && <Link href="/oportunidades/historico" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Proposições do histórico legislativo</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Proposição</th>
              <th scope="col" className="px-4 py-3">Ementa</th>
              <th scope="col" className="px-4 py-3">Autoria</th>
              <th scope="col" className="px-4 py-3">Situação</th>
              <th scope="col" className="px-4 py-3">Verificação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma proposição {filtrando ? "com esses filtros" : "cadastrada ainda. Cadastre uma a uma ou importe uma planilha"}.</td></tr>
            )}
            {lista.itens.map((p) => (
              <tr key={p.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/oportunidades/historico/${p.id}`} className="font-medium text-marca-800 hover:underline">{rotuloProposicao(p)}</Link>
                  <p className="text-xs text-slate-500">{ROTULO_TIPO_PROPOSICAO[p.tipo]}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <p className="line-clamp-2">{p.ementa}</p>
                  {p.eixo && <p className="text-xs text-slate-500">{p.eixo.nome}</p>}
                </td>
                <td className="px-4 py-3 text-slate-700">{ROTULO_PARTICIPACAO_PROPOSICAO[p.participacao]}</td>
                <td className="px-4 py-3 text-slate-700">{p.situacao ?? "—"}</td>
                <td className="px-4 py-3"><Selo cor={COR_VERIFICACAO[p.verificacao]}>{ROTULO_VERIFICACAO[p.verificacao]}</Selo></td>
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

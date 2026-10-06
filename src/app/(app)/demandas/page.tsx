import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { contadoresDemandas, listarDemandas, opcoesDemanda, type FiltrosDemanda } from "@/server/services/demandas";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import { SelecaoBairro } from "@/components/forms/demanda";
import {
  COR_STATUS, FILTROS_PRAZO, PRIORIDADES, ROTULO_PRIORIDADE, ROTULO_STATUS, STATUS, formatarData, rotuloPrazo, situacaoPrazo,
} from "@/lib/demandas";

export const metadata: Metadata = { title: "Demandas" };

type Busca = Record<string, string | undefined>;

export default async function DemandasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const filtros: FiltrosDemanda = { ...sp, pagina: Number(sp.pagina) || 1 };
  const [lista, contadores, opcoes] = await Promise.all([
    listarDemandas(prisma, ator, filtros),
    contadoresDemandas(prisma, ator),
    opcoesDemanda(prisma),
  ]);
  const link = (extra: Busca) => `/demandas?${new URLSearchParams(Object.entries({ ...extra }).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  const cards = [
    { rotulo: "Abertas", valor: contadores.abertas, href: link({ status: "abertas" }), cor: "text-slate-900" },
    { rotulo: "Atrasadas", valor: contadores.atrasadas, href: link({ prazo: "atrasadas" }), cor: "text-red-700" },
    { rotulo: "Vencem em 7 dias", valor: contadores.vence7, href: link({ prazo: "7" }), cor: "text-amber-700" },
    { rotulo: "Sem responsável", valor: contadores.semResponsavel, href: link({ status: "abertas", responsavel: "sem" }), cor: "text-slate-900" },
    { rotulo: "Minhas abertas", valor: contadores.minhas, href: link({ status: "abertas", responsavel: "eu" }), cor: "text-marca-800" },
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Demandas"
        descricao={`${lista.total} demanda${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros escolhidos" : ""}`}
        acoes={pode(ator, "dados:criar") ? <Link href="/demandas/nova" className={classeBotao()}>+ Nova demanda</Link> : undefined}
      />

      <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <li key={c.rotulo}>
            <Link href={c.href} className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:bg-slate-50">
              <span className={`block text-2xl font-semibold ${c.cor}`}>{c.valor}</span>
              <span className="text-xs text-slate-600">{c.rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Protocolo, solicitante, endereço ou descrição" />
          </div>
          <div>
            <Rotulo htmlFor="f-status">Status</Rotulo>
            <Selecao id="f-status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos</option>
              <option value="abertas">Abertas (todas)</option>
              <option value="concluidas">Concluídas (todas)</option>
              {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-prazo">Prazo</Rotulo>
            <Selecao id="f-prazo" name="prazo" defaultValue={sp.prazo ?? ""}>
              <option value="">Qualquer</option>
              {FILTROS_PRAZO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-tema">Tema</Rotulo>
            <Selecao id="f-tema" name="temaId" defaultValue={sp.temaId ?? ""}>
              <option value="">Todos</option>
              {opcoes.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-regional">Regional</Rotulo>
            <Selecao id="f-regional" name="regionalId" defaultValue={sp.regionalId ?? ""}>
              <option value="">Todas</option>
              {opcoes.regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-bairro">Bairro</Rotulo>
            <SelecaoBairro id="f-bairro" name="bairroId" regionais={opcoes.regionais} defaultValue={sp.bairroId ?? ""} />
          </div>
          <div>
            <Rotulo htmlFor="f-resp">Responsável</Rotulo>
            <Selecao id="f-resp" name="responsavel" defaultValue={sp.responsavel ?? ""}>
              <option value="">Todos</option>
              <option value="eu">Minhas</option>
              <option value="sem">Sem responsável</option>
              {opcoes.responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-prior">Prioridade</Rotulo>
            <Selecao id="f-prior" name="prioridade" defaultValue={sp.prioridade ?? ""}>
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            {filtrando && <Link href="/demandas" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Lista de demandas</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Protocolo</th>
              <th scope="col" className="px-4 py-3">Solicitante / descrição</th>
              <th scope="col" className="px-4 py-3">Tema</th>
              <th scope="col" className="px-4 py-3">Bairro</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Prazo</th>
              <th scope="col" className="px-4 py-3">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.itens.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhuma demanda encontrada.</td></tr>
            )}
            {lista.itens.map((d) => {
              const p = rotuloPrazo(situacaoPrazo(d.prazo, d.status));
              return (
                <tr key={d.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/demandas/${d.id}`} className="font-medium text-marca-800 hover:underline">{d.protocolo}</Link>
                    {(d.prioridade === "URGENTE" || d.prioridade === "ALTA") && (
                      <p className="mt-1"><Selo cor={d.prioridade === "URGENTE" ? "vermelho" : "amarelo"}>{ROTULO_PRIORIDADE[d.prioridade]}</Selo></p>
                    )}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <p className="font-medium text-slate-900">{d.pessoa.nome}</p>
                    <p className="line-clamp-2 text-xs text-slate-600">{d.descricao}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.tema.nome}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {d.bairro ? <>{d.bairro.nome}<p className="text-xs text-slate-500">{d.bairro.regional.nome}</p></> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><Selo cor={COR_STATUS[d.status]}>{ROTULO_STATUS[d.status]}</Selo></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-slate-700">{formatarData(d.prazo)}</span>
                    {d.prazo && <p className="mt-1"><Selo cor={p.cor}>{p.texto}</Selo></p>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.responsavel?.nome ?? <span className="text-amber-700">Sem responsável</span>}</td>
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

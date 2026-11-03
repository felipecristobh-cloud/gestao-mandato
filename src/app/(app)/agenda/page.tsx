import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarCompromissos, opcoesAgenda } from "@/server/services/agenda";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, Selo, classeBotao } from "@/components/ui";
import {
  COR_STATUS_COMPROMISSO, NOME_DIA, ROTULO_STATUS_COMPROMISSO, ROTULO_TIPO_COMPROMISSO, STATUS_COMPROMISSO, TIPOS_COMPROMISSO,
  diaMes, diasDoCalendario, formatarPeriodo, horaLocal, inicioDoDia, inicioMes, nomeMes, somarDiasISO, somarMeses,
} from "@/lib/agenda";
import { hojeISO } from "@/lib/demandas";

export const metadata: Metadata = { title: "Agenda" };

type Busca = Record<string, string | undefined>;
type Item = Awaited<ReturnType<typeof listarCompromissos>>["itens"][number];

const cruzaDia = (c: Item, dia: string) => c.inicio < inicioDoDia(somarDiasISO(dia, 1)) && c.fim > inicioDoDia(dia);

function Evento({ c, compacto }: { c: Item; compacto?: boolean }) {
  const riscado = c.status === "CANCELADO" || c.status === "ADIADO";
  return (
    <Link
      href={`/agenda/${c.id}`}
      className={`block rounded border-l-4 bg-white px-2 py-1 text-xs shadow-sm hover:bg-slate-50 ${c.agendaVereador ? "border-marca-700" : "border-slate-300"} ${riscado ? "opacity-60 line-through" : ""}`}
      title={`${c.titulo} — ${ROTULO_STATUS_COMPROMISSO[c.status]}`}
    >
      <span className="font-semibold text-slate-700">{horaLocal(c.inicio)}</span> <span className="text-slate-900">{c.titulo}</span>
      {!compacto && (
        <span className="mt-0.5 block text-slate-500">
          {ROTULO_TIPO_COMPROMISSO[c.tipo]} · {ROTULO_STATUS_COMPROMISSO[c.status]}{c.local ? ` · ${c.local}` : ""}
        </span>
      )}
    </Link>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const [r, opcoes] = await Promise.all([listarCompromissos(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 }), opcoesAgenda(prisma)]);
  const hoje = hojeISO();
  const filtros = { q: sp.q, tipo: sp.tipo, status: sp.status, responsavel: sp.responsavel, vereador: sp.vereador, periodo: sp.periodo };
  const link = (extra: Busca) => `/agenda?${new URLSearchParams(Object.entries({ ...filtros, visao: r.visao, data: r.data, ...extra }).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.values(filtros).some(Boolean);
  const passo = (n: number) => (r.visao === "mes" ? somarMeses(r.data, n) : somarDiasISO(r.data, 7 * n));
  const titulo = r.visao === "mes" ? nomeMes(r.data) : r.visao === "semana" ? `Semana de ${diaMes(r.de!)} a ${diaMes(somarDiasISO(r.de!, 6))}` : sp.periodo === "passados" ? "Compromissos passados" : "Próximos compromissos";

  return (
    <>
      <CabecalhoPagina
        titulo="Agenda"
        descricao="Reuniões, visitas, plenárias, audiências e eventos. Barra vermelha = agenda do vereador."
        acoes={pode(ator, "dados:criar") ? <Link href={`/agenda/nova${r.visao !== "lista" && r.data !== hoje ? `?data=${r.data}` : ""}`} className={classeBotao()}>+ Novo compromisso</Link> : undefined}
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="visao" value={r.visao} />
          <input type="hidden" name="data" value={r.data} />
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Título, local ou pauta" />
          </div>
          <div>
            <Rotulo htmlFor="f-tipo">Tipo</Rotulo>
            <Selecao id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos</option>
              {TIPOS_COMPROMISSO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_COMPROMISSO[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-status">Status</Rotulo>
            <Selecao id="f-status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos menos cancelados</option>
              <option value="todos">Todos</option>
              {STATUS_COMPROMISSO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_COMPROMISSO[s]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-resp">Pessoa</Rotulo>
            <Selecao id="f-resp" name="responsavel" defaultValue={sp.responsavel ?? ""}>
              <option value="">Todas</option>
              <option value="eu">Minha agenda</option>
              {opcoes.participantes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          {r.visao === "lista" ? (
            <div>
              <Rotulo htmlFor="f-periodo">Período</Rotulo>
              <Selecao id="f-periodo" name="periodo" defaultValue={sp.periodo ?? ""}>
                <option value="">Próximos</option>
                <option value="passados">Passados</option>
              </Selecao>
            </div>
          ) : <div />}
          <label htmlFor="f-vereador" className="flex items-center gap-2 text-sm text-slate-800 sm:col-span-2">
            <input id="f-vereador" name="vereador" value="1" type="checkbox" defaultChecked={sp.vereador === "1"} className="h-4 w-4 rounded border-slate-300" />
            Só a agenda do vereador
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {filtrando && <Link href={`/agenda?visao=${r.visao}&data=${r.data}`} className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Visão" className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {(["semana", "mes", "lista"] as const).map((v) => (
            <Link key={v} href={link({ visao: v, pagina: undefined })} aria-current={r.visao === v ? "page" : undefined}
              className={`px-3 py-1.5 ${r.visao === v ? "bg-marca-700 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
              {v === "semana" ? "Semana" : v === "mes" ? "Mês" : "Lista"}
            </Link>
          ))}
        </nav>
        <h2 className={`text-base font-semibold text-slate-900 ${r.visao === "mes" ? "capitalize" : ""}`}>{titulo}</h2>
        {r.visao !== "lista" ? (
          <div className="flex gap-2">
            <Link href={link({ data: passo(-1) })} className={classeBotao("secundario")} aria-label="Período anterior">←</Link>
            <Link href={link({ data: hoje })} className={classeBotao("secundario")}>Hoje</Link>
            <Link href={link({ data: passo(1) })} className={classeBotao("secundario")} aria-label="Próximo período">→</Link>
          </div>
        ) : <span className="text-sm text-slate-600">{r.total} compromisso(s)</span>}
      </div>

      {r.visao === "semana" && (
        <div className="grid gap-2 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => somarDiasISO(r.de!, i)).map((dia, i) => {
            const doDia = r.itens.filter((c) => cruzaDia(c, dia));
            return (
              <section key={dia} aria-label={`${NOME_DIA[i]} ${diaMes(dia)}`} className={`min-h-28 rounded-lg border p-2 ${dia === hoje ? "border-marca-600 bg-marca-50" : "border-slate-200 bg-slate-50"}`}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-600">
                  {NOME_DIA[i]} <span className="text-slate-900">{diaMes(dia)}</span>
                </h3>
                <div className="space-y-1.5">
                  {doDia.length === 0 && <p className="text-xs text-slate-400">—</p>}
                  {doDia.map((c) => <Evento key={c.id} c={c} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {r.visao === "mes" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
            {NOME_DIA.map((d) => <div key={d} className="bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">{d}</div>)}
            {diasDoCalendario(r.data).map((dia) => {
              const doDia = r.itens.filter((c) => cruzaDia(c, dia));
              const foraDoMes = inicioMes(dia) !== inicioMes(r.data);
              return (
                <div key={dia} className={`min-h-24 p-1 ${dia === hoje ? "bg-marca-50" : foraDoMes ? "bg-slate-50" : "bg-white"}`}>
                  <Link href={link({ visao: "semana", data: dia })} className={`text-xs font-semibold hover:underline ${foraDoMes ? "text-slate-400" : "text-slate-700"}`}>{Number(dia.slice(8))}</Link>
                  <div className="mt-1 space-y-1">
                    {doDia.slice(0, 3).map((c) => <Evento key={c.id} c={c} compacto />)}
                    {doDia.length > 3 && <Link href={link({ visao: "semana", data: dia })} className="block text-xs text-marca-800 hover:underline">+{doDia.length - 3} mais</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {r.visao === "lista" && (
        <>
          <Cartao className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Lista de compromissos</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Quando</th>
                  <th scope="col" className="px-4 py-3">Compromisso</th>
                  <th scope="col" className="px-4 py-3">Local</th>
                  <th scope="col" className="px-4 py-3">Responsável</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.itens.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum compromisso encontrado.</td></tr>}
                {r.itens.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatarPeriodo(c.inicio, c.fim)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/agenda/${c.id}`} className="font-medium text-marca-800 hover:underline">{c.titulo}</Link>
                      <p className="text-xs text-slate-500">{ROTULO_TIPO_COMPROMISSO[c.tipo]}{c._count.participantes ? ` · ${c._count.participantes} participante(s)` : ""}</p>
                      {c.agendaVereador && <p className="mt-1"><Selo cor="azul">Agenda do vereador</Selo></p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{[c.local, c.bairro?.nome].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{c.responsavel?.nome ?? "—"}</td>
                    <td className="px-4 py-3"><Selo cor={COR_STATUS_COMPROMISSO[c.status]}>{ROTULO_STATUS_COMPROMISSO[c.status]}</Selo></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
          {r.paginas > 1 && (
            <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
              {r.pagina > 1 ? <Link className={classeBotao("secundario")} href={link({ pagina: String(r.pagina - 1) })}>← Anterior</Link> : <span />}
              <span className="text-slate-600">Página {r.pagina} de {r.paginas}</span>
              {r.pagina < r.paginas ? <Link className={classeBotao("secundario")} href={link({ pagina: String(r.pagina + 1) })}>Próxima →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { exigirUsuario } from "@/server/auth/current";
import { prisma } from "@/server/db";
import { pode, ROTULO_PERFIL } from "@/server/authz";
import { anosEmendas, indicadoresDashboard, pontosDeAtencao, type PontosDeAtencao } from "@/server/services/dashboard";
import { Aviso, Botao, CabecalhoPagina, Cartao, Rotulo, Selecao, Selo } from "@/components/ui";
import { Barras, EmendasPorMandato, Execucao, LinhaMeses, Rosca, CORES, type ItemGrafico } from "@/components/dashboard/graficos";
import { COR_STATUS, ROTULO_STATUS, formatarData, hojeISO } from "@/lib/demandas";
import { COR_STATUS_EMENDA, ROTULO_STATUS_EMENDA, formatarMoeda } from "@/lib/emendas";
import {
  DIAS_PRAZO_DEMANDA, DIAS_PRAZO_EMENDA, DIAS_SEM_MOVIMENTACAO, PERIODOS, formatarPercentual, inicioPeriodo, lerPeriodo,
} from "@/lib/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

type Busca = { senha?: string; periodo?: string; ano?: string; minhas?: string };

const COR_HEX = { cinza: "#94a3b8", verde: "#15803d", vermelho: "#a51d1d", azul: "#2563eb", amarelo: "#d4a017" } as const;
const PLURAL_ESFERA = { MUNICIPAL: "municipais", ESTADUAL: "estaduais", FEDERAL: "federais" } as const;
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function url(base: string, p: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

function Card({ rotulo, valor, href, cor = "text-slate-900", dica, moeda }: { rotulo: string; valor: ReactNode; href?: string; cor?: string; dica?: string; moeda?: boolean }) {
  const corpo = (
    <>
      <span className={`block font-semibold ${moeda ? "text-lg tabular-nums" : "text-2xl"} ${cor}`}>{valor}</span>
      <span className="text-xs text-slate-600">{rotulo}</span>
      {dica && <span className="mt-0.5 block text-[11px] text-slate-400">{dica}</span>}
    </>
  );
  const cls = "block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
  return <li>{href ? <Link href={href} className={`${cls} hover:bg-slate-50`}>{corpo}</Link> : <div className={cls}>{corpo}</div>}</li>;
}

function Grafico({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <Cartao className={className}>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{titulo}</h3>
      {children}
    </Cartao>
  );
}

function Lista({ titulo, total, href, vazio, children }: { titulo: string; total: number; href?: string; vazio: string; children: ReactNode }) {
  return (
    <Cartao>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <span className={`text-sm font-semibold ${total ? "text-marca-700" : "text-slate-400"}`}>{total}</span>
      </div>
      {total === 0 ? <p className="text-sm text-slate-500">{vazio}</p> : <ul className="divide-y divide-slate-100 text-sm">{children}</ul>}
      {href && total > 0 && <Link href={href} className="mt-2 inline-block text-xs font-medium text-marca-700 hover:underline">Ver todas →</Link>}
    </Cartao>
  );
}

type ItemD = PontosDeAtencao["atrasadas"]["itens"][number];
function LinhaDemanda({ d, extra }: { d: ItemD; extra?: string }) {
  return (
    <li className="py-1.5">
      <Link href={`/demandas/${d.id}`} className="font-medium text-marca-700 hover:underline">{d.protocolo}</Link>{" "}
      <Selo cor={COR_STATUS[d.status]}>{ROTULO_STATUS[d.status]}</Selo>
      <span className="block text-xs text-slate-500">
        {[d.tema.nome, d.bairro?.nome, d.responsavel?.nome ?? "sem responsável", extra].filter(Boolean).join(" · ")}
      </span>
    </li>
  );
}

type ItemE = PontosDeAtencao["paradas"]["itens"][number];
function LinhaEmenda({ e, extra }: { e: ItemE; extra?: string }) {
  return (
    <li className="py-1.5">
      <Link href={`/emendas/${e.id}`} className="font-medium text-marca-700 hover:underline">{e.codigo}</Link>{" "}
      <Selo cor={COR_STATUS_EMENDA[e.status]}>{ROTULO_STATUS_EMENDA[e.status]}</Selo>
      <span className="block truncate text-xs text-slate-500" title={e.objeto}>{[e.objeto, extra].filter(Boolean).join(" · ")}</span>
    </li>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const u = await exigirUsuario();
  const sp = await searchParams;
  const cabecalho = <CabecalhoPagina titulo={`Olá, ${u.nome.split(" ")[0]}`} descricao={`Perfil: ${ROTULO_PERFIL[u.perfil]}`} />;
  const avisoSenha = sp.senha === "ok" && <div className="mb-4"><Aviso tipo="ok">Senha alterada com sucesso.</Aviso></div>;
  if (!pode(u, "dados:ver")) return <>{cabecalho}{avisoSenha}</>;

  const hoje = hojeISO();
  const f = { periodo: lerPeriodo(sp.periodo), ano: /^\d{4}$/.test(sp.ano ?? "") ? Number(sp.ano) : undefined, minhas: sp.minhas === "1" };
  const [ind, pa, anos] = await Promise.all([indicadoresDashboard(prisma, u, f, hoje), pontosDeAtencao(prisma, u, f.minhas, hoje), anosEmendas(prisma)]);
  const { demandas: d, emendas: e } = ind;

  const eu = f.minhas ? "eu" : undefined;
  const desde = inicioPeriodo(f.periodo, hoje);
  const dLink = (p: Record<string, string | number | null | undefined>) => url("/demandas", { responsavel: eu, entradaDe: desde, ...p });
  const eLink = (p: Record<string, string | number | null | undefined>) => url("/emendas", { responsavel: eu, ano: f.ano, ...p });
  const opLink = (p: Record<string, string>) => url("/demandas", { responsavel: eu, ...p });

  const item = <K,>(xs: { chave: K | null; rotulo: string; valor: number }[], href: (k: K) => string, cor?: (k: K, i: number) => string): ItemGrafico[] =>
    xs.map((x, i) => ({ rotulo: x.rotulo, valor: x.valor, href: x.chave === null ? undefined : href(x.chave), cor: x.chave === null ? "#94a3b8" : cor?.(x.chave, i) }));

  return (
    <>
      {cabecalho}
      {avisoSenha}

      <Cartao className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <Rotulo htmlFor="periodo">Demandas: entrada</Rotulo>
            <Selecao id="periodo" name="periodo" defaultValue={f.periodo}>
              {PERIODOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="ano">Emendas: ano</Rotulo>
            <Selecao id="ano" name="ano" defaultValue={f.ano ?? ""}>
              <option value="">Todos</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </Selecao>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="minhas" value="1" defaultChecked={f.minhas} className="h-4 w-4 rounded border-slate-300" />
            Só as minhas (sou responsável)
          </label>
          <Botao type="submit">Aplicar</Botao>
        </form>
      </Cartao>

      <section aria-labelledby="t-demandas" className="mb-8">
        <h2 id="t-demandas" className="mb-3 text-base font-semibold">Demandas</h2>
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Card rotulo="Total" valor={d.total} href={dLink({})} />
          <Card rotulo="Novas" valor={d.novas} href={dLink({ status: "NOVA" })} />
          <Card rotulo="Em andamento" valor={d.emAndamento} href={dLink({ status: "abertas" })} />
          <Card rotulo="Concluídas" valor={d.concluidas} href={dLink({ status: "concluidas" })} cor="text-green-700" />
          <Card rotulo="Atrasadas" valor={d.atrasadas} href={opLink({ prazo: "atrasadas" })} cor="text-red-700" dica="todo o período" />
          <Card rotulo="Taxa de conclusão" valor={formatarPercentual(d.taxaConclusao)} />
          <Card
            rotulo="Tempo médio de resolução"
            valor={d.tempoMedioDias === null ? "—" : `${d.tempoMedioDias} ${d.tempoMedioDias === 1 ? "dia" : "dias"}`}
            dica={d.resolvidasComData ? `${d.resolvidasComData} resolvidas` : undefined}
          />
        </ul>
        <div className="grid gap-4 lg:grid-cols-2">
          <Grafico titulo="Por status">
            <Rosca titulo="Demandas por status" dados={item(d.porStatus, (s) => dLink({ status: s }), (_, i) => CORES[i % CORES.length])} />
          </Grafico>
          <Grafico titulo="Entradas e conclusões por mês">
            <LinhaMeses dados={d.porMes} />
          </Grafico>
          <Grafico titulo="Por regional">
            <Barras titulo="Demandas por regional" dados={item(d.porRegional, (id) => dLink({ regionalId: id }))} />
          </Grafico>
          <Grafico titulo="Por tema">
            <Barras titulo="Demandas por tema" dados={item(d.porTema, (id) => dLink({ temaId: id }), (_, i) => CORES[i % CORES.length])} />
          </Grafico>
          <Grafico titulo="Por assessor (responsável)">
            <Barras titulo="Demandas por responsável" dados={item(d.porResponsavel, (id) => dLink({ responsavel: id }))} />
          </Grafico>
          <Grafico titulo="Por órgão (encaminhadas)">
            <Barras titulo="Demandas por órgão" dados={item(d.porOrgao, (id) => dLink({ orgaoId: id }), (_, i) => CORES[(i + 3) % CORES.length])} />
          </Grafico>
        </div>
      </section>

      <section aria-labelledby="t-emendas" className="mb-8">
        <h2 id="t-emendas" className="mb-3 text-base font-semibold">Emendas</h2>
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Card rotulo="Total de emendas" valor={e.total} href={eLink({})} />
          {e.porEsferaQtd.map((x) => (
            <Card key={x.chave} rotulo={`Emendas ${PLURAL_ESFERA[x.chave]}`} valor={x.n} href={eLink({ esfera: x.chave })} />
          ))}
          <Card rotulo="Execução (pago ÷ total)" valor={formatarPercentual(e.percentualExecucao)} />
          <Card moeda rotulo="Valor total" valor={formatarMoeda(e.valorTotal)} dica="aprovado ou indicado, sem canceladas" />
          <Card moeda rotulo="Empenhado" valor={formatarMoeda(e.empenhado)} cor="text-amber-700" />
          <Card moeda rotulo="Liquidado" valor={formatarMoeda(e.liquidado)} cor="text-orange-700" />
          <Card moeda rotulo="Pago" valor={formatarMoeda(e.pago)} cor="text-green-700" />
          <Card moeda rotulo="Pendente (total − pago)" valor={formatarMoeda(e.pendente)} cor="text-red-700" />
        </ul>
        <div className="grid gap-4 lg:grid-cols-2">
          <Grafico titulo="Execução financeira por esfera">
            <Execucao dados={e.porEsferaQtd.map((x) => ({ rotulo: x.rotulo, aprovado: x.total, empenhado: x.empenhado, liquidado: x.liquidado, pago: x.pago, href: eLink({ esfera: x.chave }) }))} />
          </Grafico>
          <Grafico titulo="Por esfera">
            <Rosca titulo="Emendas por esfera" dados={item(e.porEsferaQtd.map((x) => ({ chave: x.chave, rotulo: x.rotulo, valor: x.n })).filter((x) => x.valor), (s) => eLink({ esfera: s }))} />
          </Grafico>
          <Grafico titulo="Por status">
            <Barras titulo="Emendas por status" dados={item(e.porStatus, (s) => eLink({ status: s }), (s) => COR_HEX[COR_STATUS_EMENDA[s]])} />
          </Grafico>
          <Grafico titulo="Por mandato/parlamentar">
            <p className="mb-2 text-xs text-slate-500">Autoria só conta quando o mandato está vinculado como autor ou coautor.</p>
            <EmendasPorMandato dados={e.porParlamentar.map((p) => ({ rotulo: p.nome, autoria: p.autoria, outras: p.outras, href: eLink({ parlamentarId: p.id }) }))} />
          </Grafico>
        </div>
      </section>

      <section aria-labelledby="t-atencao">
        <h2 id="t-atencao" className="mb-1 text-base font-semibold">Pontos de atenção</h2>
        <p className="mb-3 text-xs text-slate-500">Situação atual, independente do período escolhido.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Lista titulo="Demandas atrasadas" total={pa.atrasadas.total} href={opLink({ prazo: "atrasadas" })} vazio="Nenhuma demanda atrasada.">
            {pa.atrasadas.itens.map((x) => <LinhaDemanda key={x.id} d={x} extra={`prazo ${formatarData(x.prazo)}`} />)}
          </Lista>
          <Lista titulo={`Vencem em até ${DIAS_PRAZO_DEMANDA} dias`} total={pa.vencendo.total} href={opLink({ prazo: String(DIAS_PRAZO_DEMANDA) })} vazio="Nenhuma demanda vencendo.">
            {pa.vencendo.itens.map((x) => <LinhaDemanda key={x.id} d={x} extra={`prazo ${formatarData(x.prazo)}`} />)}
          </Lista>
          {pa.semResponsavel && (
            <Lista titulo="Demandas sem responsável" total={pa.semResponsavel.total} href="/demandas?status=abertas&responsavel=sem" vazio="Todas as demandas abertas têm responsável.">
              {pa.semResponsavel.itens.map((x) => <LinhaDemanda key={x.id} d={x} />)}
            </Lista>
          )}
          <Lista titulo="Aguardando retorno de órgão" total={pa.aguardando.total} href={opLink({ retorno: "pendente" })} vazio="Nenhuma demanda aguardando retorno.">
            {pa.aguardando.itens.map((x) => <LinhaDemanda key={x.id} d={x} />)}
          </Lista>
          <Lista titulo={`Emendas sem movimentação há ${DIAS_SEM_MOVIMENTACAO} dias`} total={pa.paradas.total} href={url("/emendas", { responsavel: eu, alerta: "parada" })} vazio="Nenhuma emenda parada.">
            {pa.paradas.itens.map((x) => <LinhaEmenda key={x.id} e={x} extra={x.historico[0] ? `última em ${formatarData(x.historico[0].data)}` : undefined} />)}
          </Lista>
          <Lista titulo={`Emendas com prazo vencido ou em ${DIAS_PRAZO_EMENDA} dias`} total={pa.prazo.total} href={url("/emendas", { responsavel: eu, alerta: "prazo" })} vazio="Nenhuma emenda com prazo próximo.">
            {pa.prazo.itens.map((x) => <LinhaEmenda key={x.id} e={x} extra={`prazo ${formatarData(x.prazo)}`} />)}
          </Lista>
          <Lista titulo="Emendas com impedimento técnico" total={pa.impedimento.total} href={url("/emendas", { responsavel: eu, status: "IMPEDIMENTO_TECNICO" })} vazio="Nenhuma emenda com impedimento técnico.">
            {pa.impedimento.itens.map((x) => <LinhaEmenda key={x.id} e={x} />)}
          </Lista>
          <Lista titulo="Agenda do vereador a confirmar" total={pa.agenda.total} href="/agenda?visao=lista&status=SOLICITADO&vereador=1" vazio="Nada aguardando confirmação.">
            {pa.agenda.itens.map((c) => (
              <li key={c.id} className="py-1.5">
                <Link href={`/agenda/${c.id}`} className="font-medium text-marca-700 hover:underline">{c.titulo}</Link>
                <span className="block text-xs text-slate-500">{fmtHora.format(c.inicio)}</span>
              </li>
            ))}
          </Lista>
        </div>
      </section>
    </>
  );
}

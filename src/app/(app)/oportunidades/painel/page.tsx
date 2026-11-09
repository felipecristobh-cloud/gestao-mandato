import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { painelOportunidades } from "@/server/services/oportunidades-painel";
import { opcoesFormOportunidade } from "@/server/services/oportunidades";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, classeBotao } from "@/components/ui";
import { Barras, Rosca } from "@/components/dashboard/graficos";
import { ETAPAS_OPORTUNIDADE, ROTULO_ETAPA, ROTULO_PRIORIDADE_OPORTUNIDADE } from "@/lib/oportunidades";
import { ROTULO_VERIFICACAO, rotuloMandatoPedro } from "@/lib/proposicoes";

export const metadata: Metadata = { title: "Painel legislativo" };

type Busca = Record<string, string | undefined>;
const COR_PRIORIDADE = { MAXIMA: "#e10600", ALTA: "#d4a017", INTERMEDIARIA: "#2563eb", BAIXA: "#94a3b8" } as const;

function Card({ rotulo, valor, href, dica }: { rotulo: string; valor: ReactNode; href?: string; dica?: string }) {
  const corpo = (
    <>
      <span className="block text-2xl font-semibold text-slate-900">{valor}</span>
      <span className="text-xs text-slate-600">{rotulo}</span>
      {dica && <span className="mt-0.5 block text-[11px] text-slate-400">{dica}</span>}
    </>
  );
  const cls = "block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
  return <li>{href ? <Link href={href} className={`${cls} hover:bg-slate-50`}>{corpo}</Link> : <div className={cls}>{corpo}</div>}</li>;
}

function Grafico({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Cartao>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{titulo}</h3>
      {children}
    </Cartao>
  );
}

export default async function PainelPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const f = { de: sp.de, ate: sp.ate, eixo: sp.eixo, responsavel: sp.responsavel, etapa: sp.etapa };
  const [p, opcoes] = await Promise.all([painelOportunidades(prisma, ator, f), opcoesFormOportunidade(prisma)]);
  const filtrando = Object.values(f).some(Boolean);
  const lista = (extra: Busca) => `/oportunidades?${new URLSearchParams(Object.entries({ eixo: f.eixo, responsavel: f.responsavel, ...extra }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina
        titulo="Painel legislativo"
        descricao="Indicadores calculados na hora, a partir das propostas cadastradas."
        acoes={<Link href="/relatorios?tipo=oportunidades-lista" className={classeBotao("secundario")}>Relatórios</Link>}
      />

      <Cartao className="mb-4">
        <form key={new URLSearchParams(sp as Record<string, string>).toString()} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <Rotulo htmlFor="de">Cadastradas de</Rotulo>
            <Campo id="de" name="de" type="date" defaultValue={f.de} />
          </div>
          <div>
            <Rotulo htmlFor="ate">até</Rotulo>
            <Campo id="ate" name="ate" type="date" defaultValue={f.ate} />
          </div>
          <div>
            <Rotulo htmlFor="eixo">Tema (eixo)</Rotulo>
            <Selecao id="eixo" name="eixo" defaultValue={f.eixo ?? ""}>
              <option value="">Todos</option>
              {opcoes.eixos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="responsavel">Responsável</Rotulo>
            <Selecao id="responsavel" name="responsavel" defaultValue={f.responsavel ?? ""}>
              <option value="">Todos</option>
              <option value="eu">Eu</option>
              <option value="nenhum">Sem responsável</option>
              {opcoes.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="etapa">Situação (etapa)</Rotulo>
            <Selecao id="etapa" name="etapa" defaultValue={f.etapa ?? ""}>
              <option value="">Todas</option>
              {ETAPAS_OPORTUNIDADE.map((e, i) => <option key={e} value={e}>{i + 1}. {ROTULO_ETAPA[e]}</option>)}
            </Selecao>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={classeBotao()}>Filtrar</button>
            {filtrando && <Link href="/oportunidades/painel" className={classeBotao("fantasma")}>Limpar</Link>}
          </div>
        </form>
      </Cartao>

      <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card rotulo="Propostas cadastradas" valor={p.total} href={lista({})} />
        {p.indicadores.map((i) => (
          <Card key={i.chave} rotulo={i.rotulo} valor={i.valor} href={i.etapas.length === 1 ? lista({ etapa: i.etapas[0] }) : undefined} />
        ))}
        <Card rotulo="Média da nota de impacto" valor={p.mediaNota ?? "—"} dica={`${p.avaliadas} de ${p.total} avaliadas`} />
        <Card rotulo="Surgiram de demandas" valor={p.deDemandas} href={lista({ origem: "demanda" })} />
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Grafico titulo="Propostas por etapa">
          <Barras titulo="Propostas por etapa" dados={p.porEtapa.map((e) => ({ rotulo: e.rotulo, valor: e.valor, href: lista({ etapa: e.etapa }) }))} />
        </Grafico>
        <Grafico titulo="Prioridade">
          <Rosca
            titulo="Prioridade"
            dados={[
              ...p.porPrioridade.filter((x) => x.valor).map((x) => ({ rotulo: ROTULO_PRIORIDADE_OPORTUNIDADE[x.prioridade], valor: x.valor, cor: COR_PRIORIDADE[x.prioridade], href: lista({ prioridade: x.prioridade }) })),
              ...(p.semAvaliacao ? [{ rotulo: "Sem avaliação", valor: p.semAvaliacao, cor: "#e2e8f0", href: lista({ prioridade: "SEM" }) }] : []),
            ]}
          />
        </Grafico>
        <Grafico titulo="Propostas por eixo temático">
          <Barras titulo="Propostas por eixo temático" dados={p.porEixo.map((x) => ({ ...x, href: undefined }))} />
        </Grafico>
        <Grafico titulo="Propostas por regional de Belo Horizonte">
          <Barras titulo="Propostas por regional" dados={p.porRegional} />
        </Grafico>
        <Grafico titulo="Histórico legislativo por mandato">
          <Barras titulo="Proposições por mandato" dados={p.historico.porMandato.map((m) => ({ rotulo: rotuloMandatoPedro(m), valor: m.valor, href: `/oportunidades/historico?mandato=${m.numero}` }))} />
        </Grafico>
        <Grafico titulo="Verificação do histórico">
          <Rosca
            titulo="Verificação do histórico"
            dados={p.historico.porVerificacao.filter((v) => v.valor).map((v) => ({ rotulo: ROTULO_VERIFICACAO[v.verificacao], valor: v.valor, href: `/oportunidades/historico?verificacao=${v.verificacao}` }))}
          />
        </Grafico>
      </div>
      {p.arquivadas > 0 && <p className="mt-3 text-xs text-slate-500">{p.arquivadas} proposta(s) arquivada(s) ou suspensa(s).</p>}
    </>
  );
}

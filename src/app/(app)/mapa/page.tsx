import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesDemanda } from "@/server/services/demandas";
import { dadosMapa, type FiltrosMapa } from "@/server/services/mapa";
import { MapaDemandas } from "@/components/mapa/mapa-demandas";
import { SelecaoBairro } from "@/components/forms/demanda";
import { Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao } from "@/components/ui";
import { ROTULO_STATUS, STATUS } from "@/lib/demandas";
import { COR_ATRASADA, COR_STATUS } from "@/lib/mapa";

export const metadata: Metadata = { title: "Mapa" };

const CAMPOS = ["regionalId", "bairroId", "temaId", "status", "de", "ate"] as const;

export default async function MapaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const f: FiltrosMapa = {};
  for (const k of CAMPOS) if (sp[k]) f[k] = sp[k];
  const [m, opcoes] = await Promise.all([dadosMapa(prisma, u, f), opcoesDemanda(prisma)]);
  const aproximadas = m.pontos.length - m.exatas;

  return (
    <>
      <CabecalhoPagina titulo="Mapa das demandas" descricao="Demandas de Belo Horizonte por localização. Clique num ponto para ver o resumo." />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <Rotulo htmlFor="regionalId">Regional</Rotulo>
            <Selecao id="regionalId" name="regionalId" defaultValue={f.regionalId ?? ""}>
              <option value="">Todas</option>
              {opcoes.regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="bairroId">Bairro</Rotulo>
            <SelecaoBairro id="bairroId" name="bairroId" regionais={opcoes.regionais} defaultValue={f.bairroId ?? ""} />
          </div>
          <div>
            <Rotulo htmlFor="temaId">Tema</Rotulo>
            <Selecao id="temaId" name="temaId" defaultValue={f.temaId ?? ""}>
              <option value="">Todos</option>
              {opcoes.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="status">Status</Rotulo>
            <Selecao id="status" name="status" defaultValue={f.status ?? ""}>
              <option value="">Todos</option>
              <option value="abertas">Abertas</option>
              <option value="concluidas">Concluídas</option>
              {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="de">Entrada de</Rotulo>
            <Campo id="de" name="de" type="date" defaultValue={f.de} />
          </div>
          <div>
            <Rotulo htmlFor="ate">até</Rotulo>
            <Campo id="ate" name="ate" type="date" defaultValue={f.ate} />
          </div>
          <div className="sm:col-span-3 lg:col-span-6">
            <Botao type="submit">Filtrar</Botao>
          </div>
        </form>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Cartao className="p-2">
          <MapaDemandas pontos={m.pontos} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-xs text-slate-600" aria-label="Legenda">
            {STATUS.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: COR_STATUS[s] }} aria-hidden />{ROTULO_STATUS[s]}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: COR_ATRASADA }} aria-hidden />Atrasada
            </li>
            <li>Pontos mais claros = localização aproximada (centro do bairro)</li>
          </ul>
        </Cartao>

        <div className="space-y-4">
          <Cartao>
            <h2 className="text-sm font-semibold text-slate-900">Resumo</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Demandas filtradas</dt><dd className="font-semibold tabular-nums">{m.total}</dd></div>
              <div className="flex justify-between"><dt>No ponto exato</dt><dd className="tabular-nums">{m.exatas}</dd></div>
              <div className="flex justify-between"><dt>No centro do bairro</dt><dd className="tabular-nums">{aproximadas}</dd></div>
              <div className="flex justify-between"><dt>Sem localização</dt><dd className="tabular-nums">{m.semLocalizacao}</dd></div>
            </dl>
            {m.limitado && <p className="mt-2 text-xs text-amber-700">Mostrando só as {m.total} mais recentes. Use os filtros.</p>}
          </Cartao>
          <Cartao>
            <h2 className="text-sm font-semibold text-slate-900">Por regional</h2>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th scope="col">Regional</th><th scope="col" className="text-right">Total</th><th scope="col" className="text-right">Atrasadas</th></tr>
              </thead>
              <tbody>
                {m.porRegional.map((r) => (
                  <tr key={r.nome} className="border-t border-slate-100">
                    <td className="py-1">{r.nome}</td>
                    <td className="py-1 text-right tabular-nums">{r.total}</td>
                    <td className={`py-1 text-right tabular-nums ${r.atrasadas ? "font-semibold text-red-700" : ""}`}>{r.atrasadas}</td>
                  </tr>
                ))}
                {!m.porRegional.length && <tr><td colSpan={3} className="py-2 text-slate-500">Nenhuma demanda com esses filtros.</td></tr>}
              </tbody>
            </table>
          </Cartao>
        </div>
      </div>
    </>
  );
}

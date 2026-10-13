import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { opcoesDemanda } from "@/server/services/demandas";
import { anosEmendas } from "@/server/services/emendas";
import { gerarRelatorio, type FiltrosRelatorio } from "@/server/services/relatorios";
import { Botao, CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, classeBotao } from "@/components/ui";
import { ROTULO_STATUS, STATUS } from "@/lib/demandas";
import { ROTULO_STATUS_EMENDA, STATUS_EMENDA } from "@/lib/emendas";
import { FORMATOS, RELATORIOS, ehTipoRelatorio, formatarCelula, totais, valorCalculado, type TipoRelatorio } from "@/lib/relatorios";

export const metadata: Metadata = { title: "Relatórios" };

type Busca = Record<string, string | undefined>;
const PREVIA = 100;
const CAMPOS = ["de", "ate", "status", "regionalId", "temaId", "responsavel", "esfera", "ano", "pessoais"] as const;
const LISTAS_PESSOAIS: TipoRelatorio[] = ["demandas-atrasadas", "demandas-resolvidas"];

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const u = await exigirPermissaoPagina("relatorios:exportar");
  const sp = await searchParams;
  const tipo: TipoRelatorio = ehTipoRelatorio(sp.tipo) ? sp.tipo : "demandas-regional";
  const grupo = RELATORIOS[tipo].grupo;
  const f: FiltrosRelatorio = {};
  for (const k of CAMPOS) if (sp[k]) f[k] = sp[k];
  const podePessoais = pode(u, "relatorios:exportar_com_dados_pessoais") && LISTAS_PESSOAIS.includes(tipo);

  const [r, opcoes, anos] = await Promise.all([gerarRelatorio(prisma, u, tipo, f), opcoesDemanda(prisma), anosEmendas(prisma)]);
  const t = totais(r);
  const q = new URLSearchParams(Object.entries({ tipo, ...f }).filter(([, v]) => v) as [string, string][]);
  const link = (formato: string) => `/relatorios/exportar?${q}&formato=${formato}`;

  return (
    <>
      <CabecalhoPagina titulo="Relatórios" descricao="Escolha o relatório e os filtros, confira a prévia e baixe em CSV, Excel ou PDF." />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="tipo">Relatório</Rotulo>
            <Selecao id="tipo" name="tipo" defaultValue={tipo}>
              {(["demandas", "emendas"] as const).map((g) => (
                <optgroup key={g} label={g === "demandas" ? "Demandas" : "Emendas"}>
                  {Object.entries(RELATORIOS).filter(([, d]) => d.grupo === g).map(([k, d]) => <option key={k} value={k}>{d.titulo}</option>)}
                </optgroup>
              ))}
            </Selecao>
          </div>
          {grupo === "demandas" ? (
            <>
              <div>
                <Rotulo htmlFor="de">{tipo === "demandas-resolvidas" ? "Concluídas de" : "Entrada de"}</Rotulo>
                <Campo id="de" name="de" type="date" defaultValue={f.de} />
              </div>
              <div>
                <Rotulo htmlFor="ate">até</Rotulo>
                <Campo id="ate" name="ate" type="date" defaultValue={f.ate} />
              </div>
              {!LISTAS_PESSOAIS.includes(tipo) && (
                <div>
                  <Rotulo htmlFor="status">Status</Rotulo>
                  <Selecao id="status" name="status" defaultValue={f.status ?? ""}>
                    <option value="">Todos</option>
                    <option value="abertas">Abertas</option>
                    <option value="concluidas">Concluídas</option>
                    {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
                  </Selecao>
                </div>
              )}
              <div>
                <Rotulo htmlFor="regionalId">Regional</Rotulo>
                <Selecao id="regionalId" name="regionalId" defaultValue={f.regionalId ?? ""}>
                  <option value="">Todas</option>
                  {opcoes.regionais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </Selecao>
              </div>
              <div>
                <Rotulo htmlFor="temaId">Tema</Rotulo>
                <Selecao id="temaId" name="temaId" defaultValue={f.temaId ?? ""}>
                  <option value="">Todos</option>
                  {opcoes.temas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </Selecao>
              </div>
            </>
          ) : (
            <>
              <div>
                <Rotulo htmlFor="esfera">Esfera</Rotulo>
                <Selecao id="esfera" name="esfera" defaultValue={f.esfera ?? ""}>
                  <option value="">Todas</option>
                  <option value="MUNICIPAL">Municipal</option>
                  <option value="ESTADUAL">Estadual</option>
                  <option value="FEDERAL">Federal</option>
                </Selecao>
              </div>
              <div>
                <Rotulo htmlFor="ano">Ano</Rotulo>
                <Selecao id="ano" name="ano" defaultValue={f.ano ?? ""}>
                  <option value="">Todos</option>
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </Selecao>
              </div>
              <div>
                <Rotulo htmlFor="status">Status</Rotulo>
                <Selecao id="status" name="status" defaultValue={f.status ?? ""}>
                  <option value="">Todos, menos canceladas</option>
                  <option value="andamento">Em andamento</option>
                  <option value="todas">Todos, com canceladas</option>
                  {STATUS_EMENDA.map((s) => <option key={s} value={s}>{ROTULO_STATUS_EMENDA[s]}</option>)}
                </Selecao>
              </div>
            </>
          )}
          <div>
            <Rotulo htmlFor="responsavel">Responsável</Rotulo>
            <Selecao id="responsavel" name="responsavel" defaultValue={f.responsavel ?? ""}>
              <option value="">Todos</option>
              <option value="eu">Eu</option>
              {opcoes.responsaveis.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </Selecao>
          </div>
          {podePessoais && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="pessoais" value="1" defaultChecked={f.pessoais === "1"} className="h-4 w-4 rounded border-slate-300" />
              Incluir nome e telefone do solicitante (fica registrado na auditoria)
            </label>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <Botao type="submit">Ver prévia</Botao>
          </div>
        </form>
      </Cartao>

      <Cartao className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{r.titulo}</h2>
            <p className="text-xs text-slate-500">{r.filtros.join(" · ")}</p>
            {r.observacao && <p className="mt-1 text-xs italic text-slate-500">{r.observacao}</p>}
          </div>
          <div className="flex gap-2">
            {Object.entries(FORMATOS).map(([k, rotulo]) => (
              <a key={k} href={link(k)} className={classeBotao(k === "xlsx" ? "primario" : "secundario")} download>
                Baixar {rotulo}
              </a>
            ))}
          </div>
        </div>
      </Cartao>

      <Cartao className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              {r.colunas.map((c) => (
                <th key={c.chave} scope="col" className={`px-3 py-2 ${c.tipo === "texto" || c.tipo === "data" ? "" : "text-right"}`}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.linhas.length === 0 && (
              <tr><td colSpan={r.colunas.length} className="px-3 py-6 text-center text-slate-500">Nenhum registro com esses filtros.</td></tr>
            )}
            {r.linhas.slice(0, PREVIA).map((l, i) => (
              <tr key={i}>
                {r.colunas.map((c) => (
                  <td key={c.chave} className={`px-3 py-1.5 ${c.tipo === "texto" || c.tipo === "data" ? "" : "text-right tabular-nums"}`}>
                    {formatarCelula(valorCalculado(l, c), c.tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {t && r.linhas.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 font-semibold">
              <tr>
                {r.colunas.map((c, i) => (
                  <td key={c.chave} className={`px-3 py-2 ${c.tipo === "texto" || c.tipo === "data" ? "" : "text-right tabular-nums"}`}>
                    {i === 0 ? "Total" : c.somar || c.razao ? formatarCelula(t[c.chave] ?? null, c.tipo) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {r.linhas.length > PREVIA && (
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Mostrando {PREVIA} de {r.linhas.length} linhas. O arquivo baixado traz todas.
          </p>
        )}
      </Cartao>
    </>
  );
}

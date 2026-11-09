"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso, Botao, Campo, Rotulo, Selecao, Selo } from "@/components/ui";
import {
  ANO_MAX, ANO_MIN, PARTICIPACOES, ROTULO_PARTICIPACAO_PROPOSICAO, ROTULO_TIPO_PROPOSICAO, ROTULO_VERIFICACAO, TIPOS_PROPOSICAO, VERIFICACOES,
} from "@/lib/proposicoes";
import type { EstadoProposicao, ResultadoConferencia } from "@/server/services/proposicoes-actions";
import type { Valores } from "@/server/services/parlamentares-actions";
import type { Linha } from "@/server/proposicoes/planilha";

type Acao = (e: EstadoProposicao, f: FormData) => Promise<EstadoProposicao>;

const areaTexto =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30";

function Texto({ nome, rotulo, v, linhas = 3, obrigatorio }: { nome: string; rotulo: string; v: Valores; linhas?: number; obrigatorio?: boolean }) {
  return (
    <div className="sm:col-span-2">
      <Rotulo htmlFor={nome}>{rotulo}{obrigatorio ? " *" : ""}</Rotulo>
      <textarea id={nome} name={nome} rows={linhas} defaultValue={v[nome] ?? ""} required={obrigatorio} className={areaTexto} />
    </div>
  );
}

function Linha1({ nome, rotulo, v, tipo = "text", obrigatorio, ...p }: { nome: string; rotulo: string; v: Valores; tipo?: string; obrigatorio?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Rotulo htmlFor={nome}>{rotulo}{obrigatorio ? " *" : ""}</Rotulo>
      <Campo id={nome} name={nome} type={tipo} defaultValue={v[nome] ?? ""} required={obrigatorio} {...p} />
    </div>
  );
}

export function FormProposicao({ acao, eixos, valores: iniciais, edicao }: { acao: Acao; eixos: { id: number; nome: string }[]; valores?: Valores; edicao?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Aviso tipo="info">Cadastre só o que tiver fonte. Sem confirmação no portal da Câmara, deixe como &quot;Aguardando conferência&quot;.</Aviso>
      <div key={estado?.n ?? 0} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="tipo">Tipo de proposição *</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={v.tipo ?? ""} required>
            <option value="">—</option>
            {TIPOS_PROPOSICAO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_PROPOSICAO[t]}</option>)}
          </Selecao>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Linha1 nome="numero" rotulo="Número" v={v} obrigatorio inputMode="numeric" pattern="\d+" />
          <Linha1 nome="ano" rotulo="Ano" v={v} tipo="number" obrigatorio min={ANO_MIN} max={ANO_MAX} />
        </div>
        <Texto nome="ementa" rotulo="Ementa" v={v} obrigatorio linhas={2} />
        <div>
          <Rotulo htmlFor="participacao">Autoria / participação *</Rotulo>
          <Selecao id="participacao" name="participacao" defaultValue={v.participacao ?? ""} required>
            <option value="">—</option>
            {PARTICIPACOES.map((p) => <option key={p} value={p}>{ROTULO_PARTICIPACAO_PROPOSICAO[p]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="eixoId">Eixo temático</Rotulo>
          <Selecao id="eixoId" name="eixoId" defaultValue={v.eixoId ?? ""}>
            <option value="">—</option>
            {eixos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
        </div>
        <Linha1 nome="parlamentares" rotulo="Demais parlamentares envolvidos" v={v} />
        <Linha1 nome="dataApresentacao" rotulo="Data de apresentação" v={v} tipo="date" min={`${ANO_MIN}-01-01`} max={`${ANO_MAX}-12-31`} />
        <Texto nome="descricao" rotulo="Descrição completa" v={v} />
        <Texto nome="justificativa" rotulo="Justificativa original" v={v} linhas={4} />
        <Texto nome="comissoes" rotulo="Comissões pelas quais passou" v={v} linhas={2} />
        <Texto nome="pareceres" rotulo="Pareceres" v={v} linhas={2} />
        <Linha1 nome="situacao" rotulo="Situação atual" v={v} maxLength={300} />
        <Linha1 nome="lei" rotulo="Lei correspondente" v={v} maxLength={300} placeholder="Ex.: Lei 11.234/2020" />
        <Texto nome="resultadoVotacao" rotulo="Resultado das votações" v={v} linhas={2} />
        <Linha1 nome="dataConclusao" rotulo="Data de aprovação ou arquivamento" v={v} tipo="date" min={`${ANO_MIN}-01-01`} max={`${ANO_MAX}-12-31`} />
        <Linha1 nome="linkOficial" rotulo="Link do documento oficial (CMBH)" v={v} tipo="url" maxLength={500} />
        <fieldset className="rounded-lg border border-slate-200 p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold text-slate-800">Fonte e verificação</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Linha1 nome="fonte" rotulo="Fonte da informação" v={v} obrigatorio maxLength={500} placeholder="Ex.: Portal CMBH, Diário Oficial do Município" />
            <div>
              <Rotulo htmlFor="verificacao">Verificação documental</Rotulo>
              <Selecao id="verificacao" name="verificacao" defaultValue={v.verificacao || "AGUARDANDO"}>
                {VERIFICACOES.map((s) => <option key={s} value={s}>{ROTULO_VERIFICACAO[s]}</option>)}
              </Selecao>
            </div>
          </div>
        </fieldset>
        <Texto nome="observacoes" rotulo="Observações internas" v={v} linhas={2} />
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar proposição"}</Botao>
      </div>
    </form>
  );
}

const COLUNAS_EDITAVEIS: { campo: keyof Linha; rotulo: string; largura: string }[] = [
  { campo: "tipo", rotulo: "Tipo", largura: "w-24" },
  { campo: "numero", rotulo: "Número", largura: "w-20" },
  { campo: "ano", rotulo: "Ano", largura: "w-20" },
  { campo: "ementa", rotulo: "Ementa", largura: "w-72" },
  { campo: "participacao", rotulo: "Autoria", largura: "w-28" },
  { campo: "fonte", rotulo: "Fonte", largura: "w-36" },
  { campo: "verificacao", rotulo: "Verificação", largura: "w-32" },
  { campo: "eixo", rotulo: "Eixo", largura: "w-36" },
  { campo: "dataApresentacao", rotulo: "Apresentação", largura: "w-28" },
  { campo: "situacao", rotulo: "Situação", largura: "w-36" },
  { campo: "linkOficial", rotulo: "Link oficial", largura: "w-48" },
];

type Conferido = Extract<ResultadoConferencia, { linhas: unknown }>;

export function ImportadorProposicoes({ ler, reconferir, importar }: {
  ler: (f: FormData) => Promise<ResultadoConferencia>;
  reconferir: (l: Linha[], fonte: string) => Promise<ResultadoConferencia>;
  importar: (l: Linha[], fonte: string) => Promise<ResultadoConferencia>;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [fonte, setFonte] = useState("");
  const [conf, setConf] = useState<Conferido | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [alterado, setAlterado] = useState(false);
  const [feito, setFeito] = useState<{ importadas: number; ignoradas: number } | null>(null);

  const aplicar = (r: ResultadoConferencia) => {
    if ("erro" in r) return setErro(r.erro);
    setErro(null);
    if ("importadas" in r) { setFeito(r); setConf(null); setLinhas([]); return; }
    setConf(r);
    setLinhas(r.linhas.map((l) => l.valores));
    setAlterado(false);
  };

  if (feito) {
    return (
      <div className="space-y-3">
        <Aviso tipo="ok">{feito.importadas} proposições importadas{feito.ignoradas ? `; ${feito.ignoradas} linhas ficaram de fora (com erro ou duplicadas)` : ""}.</Aviso>
        <div className="flex gap-3">
          <Link href="/oportunidades/historico?verificacao=AGUARDANDO" className="text-sm font-medium text-marca-800 hover:underline">Ver as que aguardam conferência</Link>
          <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => setFeito(null)}>Importar outra planilha</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <form
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          iniciar(async () => aplicar(await ler(dados)));
        }}
      >
        <div>
          <Rotulo htmlFor="arquivo">Planilha (.xlsx ou .csv, até 2 MB)</Rotulo>
          <input id="arquivo" name="arquivo" type="file" accept=".xlsx,.csv" required className="block w-full text-sm" />
        </div>
        <div>
          <Rotulo htmlFor="fonte">Fonte (para linhas sem a coluna Fonte)</Rotulo>
          <Campo id="fonte" name="fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex.: Portal CMBH, consulta em 11/2026" maxLength={500} />
        </div>
        <Botao type="submit" disabled={pendente}>{pendente ? "Lendo…" : "Conferir planilha"}</Botao>
      </form>

      {conf && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Selo cor="verde">{conf.resumo.prontas} prontas</Selo>
            <Selo cor="vermelho">{conf.resumo.comErro} com erro</Selo>
            <Selo cor="amarelo">{conf.resumo.duplicadas} duplicadas</Selo>
            <Selo cor="azul">{conf.resumo.incompletas} prontas mas incompletas</Selo>
            {conf.ignoradas.length > 0 && <span className="text-xs text-slate-500">Colunas ignoradas: {conf.ignoradas.join(", ")}</span>}
          </div>
          <p className="text-xs text-slate-500">Corrija direto na tabela e clique em &quot;Conferir de novo&quot;. Só as linhas prontas são gravadas; duplicadas e com erro ficam de fora.</p>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Linha</th>
                  <th className="px-2 py-2">Situação</th>
                  {COLUNAS_EDITAVEIS.map((c) => <th key={c.campo} className="px-2 py-2">{c.rotulo}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conf.linhas.map((l, i) => (
                  <tr key={l.linha} className={l.ok ? "" : l.duplicada ? "bg-amber-50" : "bg-red-50"}>
                    <td className="px-2 py-1 align-top text-slate-500">{l.linha}</td>
                    <td className="w-64 px-2 py-1 align-top">
                      {l.ok ? <Selo cor="verde">Pronta</Selo> : <Selo cor={l.duplicada ? "amarelo" : "vermelho"}>{l.duplicada ? "Duplicada" : "Erro"}</Selo>}
                      <ul className="mt-1 space-y-0.5">
                        {l.erros.map((e) => <li key={e} className="text-red-800">{e}</li>)}
                        {l.avisos.map((a) => <li key={a} className="text-slate-500">{a}</li>)}
                      </ul>
                    </td>
                    {COLUNAS_EDITAVEIS.map((c) => (
                      <td key={c.campo} className="px-1 py-1 align-top">
                        <input
                          aria-label={`${c.rotulo}, linha ${l.linha}`}
                          className={`${c.largura} rounded border border-slate-300 px-1 py-0.5 text-xs`}
                          value={linhas[i]?.[c.campo] ?? ""}
                          onChange={(e) => {
                            const valor = e.target.value;
                            setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, [c.campo]: valor } : x)));
                            setAlterado(true);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" disabled={pendente} onClick={() => iniciar(async () => aplicar(await reconferir(linhas, fonte)))}>
              Conferir de novo
            </Botao>
            <Botao
              type="button"
              disabled={pendente || alterado || conf.resumo.prontas === 0}
              title={alterado ? "Confira de novo depois de corrigir" : undefined}
              onClick={() => {
                if (window.confirm(`Gravar ${conf.resumo.prontas} proposições no histórico?`)) iniciar(async () => aplicar(await importar(linhas, fonte)));
              }}
            >
              {alterado ? "Confira de novo antes de importar" : `Importar ${conf.resumo.prontas} prontas`}
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import {
  AVISO_JURIDICO, CRITERIOS, PRIORIDADES_OPORTUNIDADE, ROTULO_PRIORIDADE_OPORTUNIDADE, calcularNotaFinal, classificarNota, type Notas,
} from "@/lib/oportunidades";
import type { EstadoOportunidade } from "@/server/services/oportunidades-actions";
import type { Valores } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoOportunidade, f: FormData) => Promise<EstadoOportunidade>;

export type OpcoesFormOportunidade = {
  eixos: { id: number; nome: string }[];
  regionais: { id: number; nome: string; bairros: { id: number; nome: string }[] }[];
  usuarios: { id: string; nome: string }[];
};

const areaTexto =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30";

function Area(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={areaTexto} />;
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Texto({ nome, rotulo, v, obrigatorio, linhas, dica }: { nome: string; rotulo: string; v: Valores; obrigatorio?: boolean; linhas?: number; dica?: string }) {
  return (
    <div className="sm:col-span-2">
      <Rotulo htmlFor={nome}>{rotulo}{obrigatorio ? " *" : ""}</Rotulo>
      <Area id={nome} name={nome} rows={linhas} defaultValue={v[nome] ?? ""} required={obrigatorio} />
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

const lista = (s?: string) => new Set((s ?? "").split(",").filter(Boolean));

export function FormOportunidade({ acao, opcoes, valores: iniciais, edicao }: { acao: Acao; opcoes: OpcoesFormOportunidade; valores?: Valores; edicao?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  const regionais = lista(v.regionalIds);
  const bairros = [...lista(v.bairroIds)];
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <div key={estado?.n ?? 0} className="space-y-5">
        <Grupo titulo="A proposta">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="nome">Nome da proposta *</Rotulo>
            <Campo id="nome" name="nome" defaultValue={v.nome ?? ""} required maxLength={200} />
          </div>
          <div>
            <Rotulo htmlFor="eixoId">Eixo temático *</Rotulo>
            <Selecao id="eixoId" name="eixoId" defaultValue={v.eixoId ?? ""} required>
              <option value="">—</option>
              {opcoes.eixos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="responsavelId">Responsável</Rotulo>
            <Selecao id="responsavelId" name="responsavelId" defaultValue={v.responsavelId ?? ""}>
              <option value="">—</option>
              {opcoes.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <Texto nome="problema" rotulo="Problema social que enfrenta" v={v} obrigatorio />
          <Texto nome="descricaoProblema" rotulo="Descrição detalhada" v={v} obrigatorio linhas={5} />
          <Texto nome="publico" rotulo="Público beneficiado" v={v} obrigatorio linhas={2} />
          <Texto nome="objetivo" rotulo="Objetivo" v={v} obrigatorio linhas={2} />
          <Texto nome="solucao" rotulo="Solução legislativa proposta" v={v} obrigatorio />
          <Texto nome="resultados" rotulo="Resultados esperados" v={v} />
        </Grupo>

        <Grupo titulo="Onde">
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-slate-700">Regionais beneficiadas</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {opcoes.regionais.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="regionalIds" value={r.id} defaultChecked={regionais.has(String(r.id))} className="h-4 w-4 accent-marca-700" />
                  {r.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="bairroIds">Bairros beneficiados</Rotulo>
            <select id="bairroIds" name="bairroIds" multiple defaultValue={bairros} size={8} className={areaTexto}>
              {opcoes.regionais.map((r) => (
                <optgroup key={r.id} label={r.nome}>
                  {r.bairros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Segure Ctrl (ou Cmd) para marcar mais de um. No celular, toque em cada bairro.</p>
          </div>
        </Grupo>

        <Grupo titulo="Pesquisa preliminar">
          <p className="text-xs text-slate-500 sm:col-span-2">Registre só o que tiver fonte. O que ainda precisa ser pesquisado, escreva como pendência.</p>
          <Texto nome="fundamentacao" rotulo="Fundamentação jurídica preliminar" v={v} />
          <Texto nome="legislacaoRelacionada" rotulo="Legislação municipal relacionada" v={v} />
          <Texto nome="projetosSemelhantes" rotulo="Projetos semelhantes" v={v} />
          <Texto nome="parceiros" rotulo="Possíveis parceiros" v={v} linhas={2} />
        </Grupo>
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar oportunidade"}</Botao>
      </div>
    </form>
  );
}

export function FormAvaliacao({ acao, valores }: { acao: Acao; valores: Notas }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const [notas, setNotas] = useState<Notas>(valores);
  const final = calcularNotaFinal(notas);
  // Envio manual: com <form action>, o React reseta o formulário e os selects controlados mostrariam a nota antiga.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
      className="space-y-4"
    >
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {CRITERIOS.map((c) => (
          <div key={c.campo}>
            <Rotulo htmlFor={c.campo}>{c.rotulo} <span className="font-normal text-slate-500">(peso {c.peso}%)</span></Rotulo>
            <Selecao
              id={c.campo} name={c.campo} required value={notas[c.campo] ?? ""}
              onChange={(e) => setNotas((n) => ({ ...n, [c.campo]: e.target.value === "" ? null : Number(e.target.value) }))}
            >
              <option value="">—</option>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Selecao>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-700" aria-live="polite">
        Nota final: <strong>{final ?? "—"}</strong> de 100{final !== null && <> · {ROTULO_PRIORIDADE_OPORTUNIDADE[classificarNota(final)]}</>}
      </p>
      <Aviso tipo="info">{AVISO_JURIDICO}</Aviso>
      <div className="flex justify-end"><Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar avaliação"}</Botao></div>
    </form>
  );
}

export function FormPrioridade({ acao, atual }: { acao: Acao; atual: string | null }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} className="space-y-3">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div key={estado?.n ?? 0} className="space-y-3">
        <div>
          <Rotulo htmlFor="prioridade">Prioridade manual</Rotulo>
          <Selecao id="prioridade" name="prioridade" defaultValue={atual ?? ""}>
            <option value="">Automática (pela nota)</option>
            {PRIORIDADES_OPORTUNIDADE.map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE_OPORTUNIDADE[p]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="justificativa">Justificativa *</Rotulo>
          <Area id="justificativa" name="justificativa" required minLength={10} />
        </div>
      </div>
      <div className="flex justify-end"><Botao type="submit" variante="secundario" disabled={enviando}>Alterar prioridade</Botao></div>
    </form>
  );
}

export function FormEixo({ acao }: { acao: Acao }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} className="space-y-3">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div key={estado?.n ?? 0} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Rotulo htmlFor="nome">Novo eixo temático</Rotulo>
          <Campo id="nome" name="nome" required maxLength={80} />
        </div>
        <Botao type="submit" disabled={enviando}>Adicionar</Botao>
      </div>
    </form>
  );
}

export function BotaoAlternarEixo({ acao, ativo }: { acao: Acao; ativo: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} className="inline">
      <button type="submit" disabled={enviando} className="text-sm text-marca-800 hover:underline disabled:opacity-60">{ativo ? "Inativar" : "Reativar"}</button>
      {estado?.erro && <span role="alert" className="ml-2 text-xs text-red-700">{estado.erro}</span>}
    </form>
  );
}

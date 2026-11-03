"use client";

import { useActionState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { SelecaoBairro } from "@/components/forms/demanda";
import { ROTULO_STATUS_COMPROMISSO, ROTULO_TIPO_COMPROMISSO, STATUS_COMPROMISSO, STATUS_EXIGE_MOTIVO_COMPROMISSO, TIPOS_COMPROMISSO } from "@/lib/agenda";
import type { EstadoAgenda } from "@/server/services/agenda-actions";
import type { Valores } from "@/server/services/parlamentares-actions";
import type { OpcoesAgenda, OpcoesAlvos } from "@/server/services/agenda";

type Acao = (e: EstadoAgenda, f: FormData) => Promise<EstadoAgenda>;

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

function SelecaoAlvo({ grupos, ...p }: { grupos: OpcoesAlvos } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Selecao {...p}>
      <option value="">—</option>
      {grupos.filter((g) => g.opcoes.length).map((g) => (
        <optgroup key={g.tipo} label={g.rotulo}>
          {g.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </optgroup>
      ))}
    </Selecao>
  );
}

export function FormCompromisso({
  acao, opcoes, alvos, valores: iniciais, edicao, podeConfirmarVereador,
}: { acao: Acao; opcoes: OpcoesAgenda; alvos?: OpcoesAlvos; valores?: Valores; edicao?: boolean; podeConfirmarVereador?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  const participantes = new Set((v.participantes ?? "").split(",").filter(Boolean));
  const choques = estado?.choques;
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {choques && choques.length > 0 && (
        <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Choque de horário: já há compromisso no mesmo período com as mesmas pessoas.</p>
          <ul className="space-y-1">
            {choques.map((c) => (
              <li key={c.id}>
                <a href={`/agenda/${c.id}`} target="_blank" rel="noreferrer" className="font-medium text-marca-800 underline">{c.titulo}</a>
                {" "}— {c.periodo}
                {c.pessoas.length > 0 && <> · {c.pessoas.join(", ")}</>}
                {c.agendaVereador && <> · agenda do vereador</>}
              </li>
            ))}
          </ul>
          <input type="hidden" name="confirmar" value="1" />
          <p>Ajuste o horário ou clique em <strong>Salvar mesmo assim</strong>.</p>
        </div>
      )}
      {v.vinculo && <input type="hidden" name="vinculo" value={v.vinculo} />}
      <div key={estado?.n ?? 0} className="space-y-5">
        <Grupo titulo="Compromisso">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="titulo">Título *</Rotulo>
            <Campo id="titulo" name="titulo" required minLength={3} maxLength={200} defaultValue={v.titulo} />
          </div>
          <div>
            <Rotulo htmlFor="tipo">Tipo *</Rotulo>
            <Selecao id="tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
              <option value="">Escolha…</option>
              {TIPOS_COMPROMISSO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_COMPROMISSO[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="responsavelId">Responsável</Rotulo>
            <Selecao id="responsavelId" name="responsavelId" defaultValue={v.responsavelId ?? ""}>
              <option value="">—</option>
              {opcoes.responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="inicio">Início *</Rotulo>
            <Campo id="inicio" name="inicio" type="datetime-local" required defaultValue={v.inicio} />
          </div>
          <div>
            <Rotulo htmlFor="fim">Término *</Rotulo>
            <Campo id="fim" name="fim" type="datetime-local" required defaultValue={v.fim} />
          </div>
          <div>
            <Rotulo htmlFor="local">Local</Rotulo>
            <Campo id="local" name="local" maxLength={200} defaultValue={v.local} />
          </div>
          <div>
            <Rotulo htmlFor="bairroId">Bairro (define a regional)</Rotulo>
            <SelecaoBairro id="bairroId" name="bairroId" regionais={opcoes.regionais} defaultValue={v.bairroId ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="pauta">Pauta</Rotulo>
            <Area id="pauta" name="pauta" maxLength={4000} defaultValue={v.pauta} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="agendaVereador" className="flex items-start gap-2 text-sm text-slate-800">
              <input id="agendaVereador" name="agendaVereador" type="checkbox" defaultChecked={v.agendaVereador === "on"} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>Agenda do vereador (precisa de confirmação da coordenação)</span>
            </label>
            {!edicao && (
              <label htmlFor="confirmado" className="flex items-start gap-2 text-sm text-slate-800">
                <input id="confirmado" name="confirmado" type="checkbox" defaultChecked={v.confirmado === "on"} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                <span>Já confirmado{podeConfirmarVereador ? "" : " (na agenda do vereador, só a coordenação confirma)"}</span>
              </label>
            )}
          </div>
        </Grupo>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Participantes internos</legend>
          <p className="mb-2 text-xs text-slate-500">Usados no aviso de choque de horário.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {opcoes.participantes.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" name="participantes" value={u.id} defaultChecked={participantes.has(u.id)} className="h-4 w-4 rounded border-slate-300" />
                {u.nome}
              </label>
            ))}
          </div>
        </fieldset>

        {!edicao && alvos && !v.vinculo && (
          <Grupo titulo="Vínculo (opcional)">
            <div className="sm:col-span-2">
              <Rotulo htmlFor="vinculo-novo">Ligar a uma demanda, emenda, entidade, parlamentar ou mandato</Rotulo>
              <SelecaoAlvo id="vinculo-novo" name="vinculo" grupos={alvos} defaultValue="" />
              <p className="mt-1 text-xs text-slate-500">Outros vínculos podem ser adicionados na página do compromisso.</p>
            </div>
          </Grupo>
        )}
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : choques?.length ? "Salvar mesmo assim" : edicao ? "Salvar alterações" : "Cadastrar compromisso"}
        </Botao>
      </div>
    </form>
  );
}

function useMiniForm(acao: Acao) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro ? estado.valores ?? {} : {};
  const aviso = estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
  return { enviar, enviando, v, aviso, chave: estado?.n ?? 0 };
}

export function FormStatusCompromisso({ acao, atual, podeConfirmar }: { acao: Acao; atual: string; podeConfirmar: boolean }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  const opcoes = STATUS_COMPROMISSO.filter((s) => s !== atual && (s !== "CONFIRMADO" || podeConfirmar));
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="space-y-3">
        <div>
          <Rotulo htmlFor="st-status">Novo status</Rotulo>
          <Selecao id="st-status" name="status" required defaultValue={v.status ?? ""}>
            <option value="">Escolha…</option>
            {opcoes.map((s) => <option key={s} value={s}>{ROTULO_STATUS_COMPROMISSO[s]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="st-motivo">Motivo / observação ({STATUS_EXIGE_MOTIVO_COMPROMISSO.map((s) => ROTULO_STATUS_COMPROMISSO[s].toLowerCase()).join(" e ")} exigem)</Rotulo>
          <Area id="st-motivo" name="motivo" rows={2} maxLength={2000} defaultValue={v.motivo} />
        </div>
      </div>
      {!podeConfirmar && <p className="text-xs text-slate-500">Na agenda do vereador, a confirmação é feita pela coordenação.</p>}
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Alterar status"}</Botao>
    </form>
  );
}

export function FormResultado({ acao, valores }: { acao: Acao; valores: Valores }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = { ...valores, ...(estado?.erro ? estado.valores ?? {} : {}) };
  return (
    <form action={enviar} className="space-y-3">
      {estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div key={estado?.n ?? 0} className="space-y-3">
        <div>
          <Rotulo htmlFor="resultado">O que foi tratado / decidido *</Rotulo>
          <Area id="resultado" name="resultado" rows={5} required minLength={3} maxLength={8000} defaultValue={v.resultado} />
        </div>
        <div>
          <Rotulo htmlFor="encaminhamentos">Encaminhamentos (quem faz o quê, até quando)</Rotulo>
          <Area id="encaminhamentos" name="encaminhamentos" rows={3} maxLength={4000} defaultValue={v.encaminhamentos} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar resultado"}</Botao>
    </form>
  );
}

export function FormVinculoCompromisso({ acao, alvos }: { acao: Acao; alvos: OpcoesAlvos }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave}>
        <Rotulo htmlFor="alvo">Registro *</Rotulo>
        <SelecaoAlvo id="alvo" name="alvo" grupos={alvos} required defaultValue={v.alvo ?? ""} />
      </div>
      <Botao type="submit" variante="secundario" disabled={enviando}>{enviando ? "Salvando…" : "Vincular"}</Botao>
    </form>
  );
}

export function FormComentarioCompromisso({ acao }: { acao: Acao }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave}>
        <Rotulo htmlFor="texto">Comentário</Rotulo>
        <Area id="texto" name="texto" rows={2} required maxLength={2000} defaultValue={v.texto} />
      </div>
      <Botao type="submit" variante="secundario" disabled={enviando}>{enviando ? "Salvando…" : "Comentar"}</Botao>
    </form>
  );
}

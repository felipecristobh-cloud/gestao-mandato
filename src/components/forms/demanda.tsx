"use client";

import { useActionState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { PRIORIDADES, ROTULO_PRIORIDADE, ROTULO_STATUS, ROTULO_TIPO, STATUS, TIPOS } from "@/lib/demandas";
import type { EstadoDemanda, Valores } from "@/server/services/demandas-actions";

type Acao = (e: EstadoDemanda, f: FormData) => Promise<EstadoDemanda>;

export type OpcoesDemanda = {
  temas: { id: number; nome: string }[];
  orgaos: { id: number; nome: string; sigla: string | null }[];
  regionais: { id: number; nome: string; bairros: { id: number; nome: string }[] }[];
  responsaveis: { id: string; nome: string }[];
};

const areaTexto =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30";

function Area(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...p} className={areaTexto} />;
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function SelecaoBairro({ regionais, ...p }: { regionais: OpcoesDemanda["regionais"] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Selecao {...p}>
      <option value="">—</option>
      {regionais.map((r) => (
        <optgroup key={r.id} label={`Regional ${r.nome}`}>
          {r.bairros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </optgroup>
      ))}
    </Selecao>
  );
}

export function FormDemanda({ acao, opcoes, valores: iniciais, edicao }: { acao: Acao; opcoes: OpcoesDemanda; valores?: Valores; edicao?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  const sem = !edicao && estado?.semelhantes;
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {sem && (
        <div role="alert" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Atenção: encontramos registros parecidos. Confira antes de salvar para não duplicar.</p>
          {sem.demandas.length > 0 && (
            <div>
              <p className="font-medium">Demandas parecidas:</p>
              <ul className="mt-1 space-y-1">
                {sem.demandas.map((d) => (
                  <li key={d.id}>
                    <a href={`/demandas/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-marca-800 underline">{d.protocolo}</a>
                    {" "}— {d.nome}{d.bairro ? ` (${d.bairro})` : ""}, {ROTULO_STATUS[d.status]}: <span className="text-amber-900">{d.descricao}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <fieldset>
            <legend className="font-medium">Solicitante:</legend>
            <div className="mt-1 space-y-1">
              {sem.pessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input type="radio" name="pessoaId" value={p.id} />
                  Usar cadastro existente: <strong>{p.nome}</strong>{p.telefone ? ` · ${p.telefone}` : ""} · {p.demandas} demanda(s)
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input type="radio" name="pessoaId" value="" defaultChecked />
                {sem.pessoas.length ? "É outra pessoa — cadastrar novo solicitante" : "Cadastrar com os dados informados"}
              </label>
            </div>
          </fieldset>
          <input type="hidden" name="confirmar" value="1" />
          <p>Se não for duplicada, clique em <strong>Confirmar cadastro</strong>.</p>
        </div>
      )}

      <div key={estado?.n ?? 0} className="space-y-5">
        <Grupo titulo="Solicitante">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="solicitanteNome">Nome *</Rotulo>
            <Campo id="solicitanteNome" name="solicitanteNome" required minLength={3} maxLength={120} defaultValue={v.solicitanteNome} />
          </div>
          <div>
            <Rotulo htmlFor="telefone">Telefone</Rotulo>
            <Campo id="telefone" name="telefone" type="tel" maxLength={30} defaultValue={v.telefone} placeholder="(31) 9____-____" />
          </div>
          <div>
            <Rotulo htmlFor="email">E-mail</Rotulo>
            <Campo id="email" name="email" type="email" maxLength={160} defaultValue={v.email} />
          </div>
          <div>
            <Rotulo htmlFor="endereco">Endereço</Rotulo>
            <Campo id="endereco" name="endereco" maxLength={200} defaultValue={v.endereco} />
          </div>
          <div>
            <Rotulo htmlFor="bairroId">Bairro (define a regional)</Rotulo>
            <SelecaoBairro id="bairroId" name="bairroId" regionais={opcoes.regionais} defaultValue={v.bairroId ?? ""} />
          </div>
        </Grupo>

        <Grupo titulo="Demanda">
          <div>
            <Rotulo htmlFor="temaId">Tema *</Rotulo>
            <Selecao id="temaId" name="temaId" required defaultValue={v.temaId ?? ""}>
              <option value="">Escolha…</option>
              {opcoes.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="tipo">Tipo</Rotulo>
            <Selecao id="tipo" name="tipo" defaultValue={v.tipo || "SOLICITACAO"}>
              {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
            </Selecao>
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="descricao">Descrição *</Rotulo>
            <Area id="descricao" name="descricao" required minLength={10} maxLength={4000} defaultValue={v.descricao} />
          </div>
          <div>
            <Rotulo htmlFor="prioridade">Prioridade</Rotulo>
            <Selecao id="prioridade" name="prioridade" defaultValue={v.prioridade || "MEDIA"}>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
            </Selecao>
          </div>
          {!edicao && (
            <div>
              <Rotulo htmlFor="status">Status</Rotulo>
              <Selecao id="status" name="status" defaultValue={v.status || "NOVA"}>
                {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
              </Selecao>
            </div>
          )}
          <div>
            <Rotulo htmlFor="responsavelId">Responsável</Rotulo>
            <Selecao id="responsavelId" name="responsavelId" defaultValue={v.responsavelId ?? ""}>
              <option value="">Sem responsável</option>
              {opcoes.responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="prazo">Prazo</Rotulo>
            <Campo id="prazo" name="prazo" type="date" defaultValue={v.prazo} />
          </div>
          <div>
            <Rotulo htmlFor="orgaoId">Órgão</Rotulo>
            <Selecao id="orgaoId" name="orgaoId" defaultValue={v.orgaoId ?? ""}>
              <option value="">—</option>
              {opcoes.orgaos.map((o) => <option key={o.id} value={o.id}>{o.sigla ? `${o.sigla} — ${o.nome}` : o.nome}</option>)}
            </Selecao>
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="observacoes">Observações internas</Rotulo>
            <Area id="observacoes" name="observacoes" rows={2} maxLength={4000} defaultValue={v.observacoes} />
          </div>
        </Grupo>
      </div>

      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : sem ? "Confirmar cadastro" : edicao ? "Salvar alterações" : "Cadastrar demanda"}
        </Botao>
      </div>
    </form>
  );
}

function useMiniForm(acao: Acao) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro ? estado.valores ?? {} : {};
  const aviso = estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
  return { estado, enviar, enviando, v, aviso, chave: estado?.n ?? 0 };
}

export function FormStatus({ acao, atual }: { acao: Acao; atual: string }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="space-y-3">
        <div>
          <Rotulo htmlFor="status">Novo status</Rotulo>
          <Selecao id="status" name="status" required defaultValue={v.status ?? ""}>
            <option value="">Escolha…</option>
            {STATUS.filter((s) => s !== atual).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="comentario">Comentário (obrigatório para cancelar ou não resolvida)</Rotulo>
          <Area id="comentario" name="comentario" rows={2} maxLength={2000} defaultValue={v.comentario} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Alterar status"}</Botao>
    </form>
  );
}

export function FormComentario({ acao }: { acao: Acao }) {
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

export function FormEncaminhar({ acao, orgaos }: { acao: Acao; orgaos: OpcoesDemanda["orgaos"] }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor="enc-orgao">Órgão *</Rotulo>
          <Selecao id="enc-orgao" name="orgaoId" required defaultValue={v.orgaoId ?? ""}>
            <option value="">Escolha…</option>
            {orgaos.map((o) => <option key={o.id} value={o.id}>{o.sigla ? `${o.sigla} — ${o.nome}` : o.nome}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="enc-protocolo">Protocolo no órgão</Rotulo>
          <Campo id="enc-protocolo" name="protocolo" maxLength={60} defaultValue={v.protocolo} />
        </div>
        <div>
          <Rotulo htmlFor="enc-prazo">Prazo de retorno</Rotulo>
          <Campo id="enc-prazo" name="prazoRetorno" type="date" defaultValue={v.prazoRetorno} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="enc-descricao">O que foi pedido *</Rotulo>
          <Area id="enc-descricao" name="descricao" rows={2} required maxLength={2000} defaultValue={v.descricao} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Registrar encaminhamento"}</Botao>
    </form>
  );
}

export function FormRetorno({ acao, id }: { acao: Acao; id: string }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="mt-2 space-y-2">
      {aviso}
      <div key={chave} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <Rotulo htmlFor={`ret-${id}`}>Retorno do órgão</Rotulo>
          <Campo id={`ret-${id}`} name="retorno" required maxLength={2000} defaultValue={v.retorno} />
        </div>
        <div>
          <Rotulo htmlFor={`retd-${id}`}>Data</Rotulo>
          <Campo id={`retd-${id}`} name="dataRetorno" type="date" defaultValue={v.dataRetorno} />
        </div>
      </div>
      <Botao type="submit" variante="secundario" disabled={enviando}>{enviando ? "Salvando…" : "Registrar retorno"}</Botao>
    </form>
  );
}

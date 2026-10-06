"use client";

import { useActionState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import {
  CARGOS, DESCRICAO_PARTICIPACAO, ESFERAS, ROTULO_CARGO, ROTULO_ESFERA, ROTULO_PARTICIPACAO, TIPOS_PARTICIPACAO_DEMANDA, UFS,
} from "@/lib/parlamentares";
import type { EstadoForm, Valores } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoForm, f: FormData) => Promise<EstadoForm>;

const areaTexto =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30";

function Area(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={areaTexto} />;
}

function Marcar({ id, name, defaultChecked, children }: { id: string; name: string; defaultChecked?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-slate-800">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
      <span>{children}</span>
    </label>
  );
}

function SelecaoUf(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Selecao {...p}>
      <option value="">—</option>
      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
    </Selecao>
  );
}

function CamposCargo({ prefixo, v }: { prefixo: string; v: Valores }) {
  return (
    <>
      <div>
        <Rotulo htmlFor={`${prefixo}cargo`}>Cargo *</Rotulo>
        <Selecao id={`${prefixo}cargo`} name="cargo" required defaultValue={v.cargo ?? ""}>
          <option value="">Escolha…</option>
          {CARGOS.map((c) => <option key={c} value={c}>{ROTULO_CARGO[c]}</option>)}
        </Selecao>
      </div>
      <div>
        <Rotulo htmlFor={`${prefixo}esfera`}>Esfera (só para cargo &quot;Outro&quot;)</Rotulo>
        <Selecao id={`${prefixo}esfera`} name="esfera" defaultValue={v.esfera ?? ""}>
          <option value="">Pelo cargo</option>
          {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
        </Selecao>
      </div>
    </>
  );
}

export function FormParlamentar({ acao, valores: iniciais, edicao, podeDefinirProprio }: { acao: Acao; valores?: Valores; edicao?: boolean; podeDefinirProprio?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <div key={estado?.n ?? 0} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor="nome">Nome *</Rotulo>
          <Campo id="nome" name="nome" required minLength={3} maxLength={120} defaultValue={v.nome} />
        </div>
        <CamposCargo prefixo="" v={v} />
        <div>
          <Rotulo htmlFor="partido">Partido</Rotulo>
          <Campo id="partido" name="partido" maxLength={30} defaultValue={v.partido} />
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <Rotulo htmlFor="municipio">Município</Rotulo>
            <Campo id="municipio" name="municipio" maxLength={80} defaultValue={v.municipio} />
          </div>
          <div>
            <Rotulo htmlFor="uf">UF</Rotulo>
            <SelecaoUf id="uf" name="uf" defaultValue={v.uf ?? ""} />
          </div>
        </div>
        <div>
          <Rotulo htmlFor="telefone">Telefone do gabinete</Rotulo>
          <Campo id="telefone" name="telefone" type="tel" maxLength={30} defaultValue={v.telefone} />
        </div>
        <div>
          <Rotulo htmlFor="email">E-mail institucional</Rotulo>
          <Campo id="email" name="email" type="email" maxLength={160} defaultValue={v.email} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="observacoes">Observações</Rotulo>
          <Area id="observacoes" name="observacoes" maxLength={4000} defaultValue={v.observacoes} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Marcar id="ativo" name="ativo" defaultChecked={v.ativo === undefined ? true : v.ativo === "on"}>Ativo (aparece nas listas de vínculo)</Marcar>
          {podeDefinirProprio && (
            <Marcar id="proprio" name="proprio" defaultChecked={v.proprio === "on"}>
              Mandato próprio (titular deste gabinete). Não gera autoria automática em nada.
            </Marcar>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar parlamentar"}</Botao>
      </div>
    </form>
  );
}

function useMiniForm(acao: Acao, limparNoSucesso = true) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro || !limparNoSucesso ? estado?.valores ?? {} : {};
  const aviso = estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
  return { enviar, enviando, v, aviso, chave: estado?.n ?? 0 };
}

export function FormMandato({ acao, valores, rotuloBotao, prefixo = "m-" }: { acao: Acao; valores?: Valores; rotuloBotao: string; prefixo?: string }) {
  const { enviar, enviando, v: depois, aviso, chave } = useMiniForm(acao, !valores);
  const v: Valores = { ...valores, ...depois };
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="grid gap-3 sm:grid-cols-2">
        <CamposCargo prefixo={prefixo} v={v} />
        <div>
          <Rotulo htmlFor={`${prefixo}inicio`}>Início *</Rotulo>
          <Campo id={`${prefixo}inicio`} name="dataInicio" type="date" required defaultValue={v.dataInicio} />
        </div>
        <div>
          <Rotulo htmlFor={`${prefixo}fim`}>Fim (vazio = em aberto)</Rotulo>
          <Campo id={`${prefixo}fim`} name="dataFim" type="date" defaultValue={v.dataFim} />
        </div>
        <div>
          <Rotulo htmlFor={`${prefixo}legislatura`}>Legislatura</Rotulo>
          <Campo id={`${prefixo}legislatura`} name="legislatura" maxLength={40} placeholder="Ex.: 2025–2028" defaultValue={v.legislatura} />
        </div>
        <div>
          <Rotulo htmlFor={`${prefixo}partido`}>Partido no mandato</Rotulo>
          <Campo id={`${prefixo}partido`} name="partido" maxLength={30} placeholder="Vazio = partido atual" defaultValue={v.partido} />
        </div>
        <div>
          <Rotulo htmlFor={`${prefixo}municipio`}>Município</Rotulo>
          <Campo id={`${prefixo}municipio`} name="municipio" maxLength={80} placeholder="Vazio = do parlamentar" defaultValue={v.municipio} />
        </div>
        <div>
          <Rotulo htmlFor={`${prefixo}uf`}>UF</Rotulo>
          <SelecaoUf id={`${prefixo}uf`} name="uf" defaultValue={v.uf ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor={`${prefixo}descricao`}>Descrição</Rotulo>
          <Campo id={`${prefixo}descricao`} name="descricao" maxLength={200} defaultValue={v.descricao} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor={`${prefixo}obs`}>Observações</Rotulo>
          <Area id={`${prefixo}obs`} name="observacoes" rows={2} maxLength={2000} defaultValue={v.observacoes} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : rotuloBotao}</Botao>
    </form>
  );
}

export function FormVinculoMandato({ acao, opcoes }: { acao: Acao; opcoes: { id: string; rotulo: string }[] }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  if (opcoes.length === 0) return <p className="text-sm text-slate-500">Nenhum mandato parceiro cadastrado. Cadastre em Parlamentares e Mandatos.</p>;
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="space-y-3">
        <div>
          <Rotulo htmlFor="vinc-mandato">Mandato parceiro *</Rotulo>
          <Selecao id="vinc-mandato" name="mandatoId" required defaultValue={v.mandatoId ?? ""}>
            <option value="">Escolha…</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="vinc-tipo">Participação *</Rotulo>
          <Selecao id="vinc-tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
            <option value="">Escolha…</option>
            {TIPOS_PARTICIPACAO_DEMANDA.map((t) => <option key={t} value={t}>{ROTULO_PARTICIPACAO[t]} — {DESCRICAO_PARTICIPACAO[t]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="vinc-obs">Observações</Rotulo>
          <Campo id="vinc-obs" name="observacoes" maxLength={1000} defaultValue={v.observacoes} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Vincular mandato"}</Botao>
    </form>
  );
}

export function BotaoConfirmar({ acao, rotulo, pergunta }: { acao: Acao; rotulo: string; pergunta: string }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} onSubmit={(e) => { if (!window.confirm(pergunta)) e.preventDefault(); }} className="inline">
      {estado?.erro && <span role="alert" className="mr-2 text-xs text-red-700">{estado.erro}</span>}
      <button type="submit" disabled={enviando} className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50">
        {enviando ? "Removendo…" : rotulo}
      </button>
    </form>
  );
}

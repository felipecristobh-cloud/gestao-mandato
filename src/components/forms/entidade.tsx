"use client";

import { useActionState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { SelecaoBairro } from "@/components/forms/demanda";
import { formatarCnpj } from "@/lib/emendas";
import { ROTULO_TIPO_ENTIDADE, TIPOS_ENTIDADE } from "@/lib/entidades";
import { DESCRICAO_PARTICIPACAO, ROTULO_PARTICIPACAO, TIPOS_PARTICIPACAO_DEMANDA } from "@/lib/parlamentares";
import type { EstadoEntidade } from "@/server/services/entidades-actions";
import type { Valores } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoEntidade, f: FormData) => Promise<EstadoEntidade>;

export type OpcoesFormEntidade = {
  temas: { id: number; nome: string }[];
  regionais: { id: number; nome: string; bairros: { id: number; nome: string }[] }[];
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

export function FormEntidade({ acao, opcoes, valores: iniciais, edicao }: { acao: Acao; opcoes: OpcoesFormEntidade; valores?: Valores; edicao?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  const sem = !edicao && estado?.semelhantes;
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {sem && sem.length > 0 && (
        <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Atenção: já existem entidades parecidas. Confira antes de salvar para não duplicar.</p>
          <ul className="space-y-1">
            {sem.map((e) => (
              <li key={e.id}>
                <a href={`/entidades/${e.id}`} target="_blank" rel="noreferrer" className="font-medium text-marca-800 underline">{e.nome}</a>
                {e.cnpj ? ` — CNPJ ${formatarCnpj(e.cnpj)}` : ""}{e.ativo ? "" : " (inativa)"}
              </li>
            ))}
          </ul>
          <input type="hidden" name="confirmar" value="1" />
          <p>Se for outra entidade, clique em <strong>Confirmar cadastro</strong>.</p>
        </div>
      )}
      <div key={estado?.n ?? 0} className="space-y-5">
        <Grupo titulo="Identificação">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="nome">Nome *</Rotulo>
            <Campo id="nome" name="nome" required minLength={3} maxLength={200} defaultValue={v.nome} />
          </div>
          <div>
            <Rotulo htmlFor="cnpj">CNPJ</Rotulo>
            <Campo id="cnpj" name="cnpj" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" defaultValue={v.cnpj} />
          </div>
          <div>
            <Rotulo htmlFor="tipo">Tipo *</Rotulo>
            <Selecao id="tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
              <option value="">Escolha…</option>
              {TIPOS_ENTIDADE.map((t) => <option key={t} value={t}>{ROTULO_TIPO_ENTIDADE[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="temaId">Área de atuação</Rotulo>
            <Selecao id="temaId" name="temaId" defaultValue={v.temaId ?? ""}>
              <option value="">—</option>
              {opcoes.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="responsavel">Responsável / contato na entidade</Rotulo>
            <Campo id="responsavel" name="responsavel" maxLength={120} defaultValue={v.responsavel} />
          </div>
        </Grupo>
        <Grupo titulo="Contato e local">
          <div>
            <Rotulo htmlFor="telefone">Telefone</Rotulo>
            <Campo id="telefone" name="telefone" type="tel" maxLength={30} defaultValue={v.telefone} />
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
          <div className="sm:col-span-2">
            <Rotulo htmlFor="observacoes">Observações</Rotulo>
            <Area id="observacoes" name="observacoes" maxLength={4000} defaultValue={v.observacoes} />
          </div>
          <label htmlFor="ativo" className="flex items-start gap-2 text-sm text-slate-800 sm:col-span-2">
            <input id="ativo" name="ativo" type="checkbox" defaultChecked={v.ativo === undefined ? true : v.ativo === "on"} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span>Ativa (aparece nas listas de vínculo de demandas, emendas e agenda)</span>
          </label>
        </Grupo>
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : edicao ? "Salvar alterações" : sem && sem.length ? "Confirmar cadastro" : "Cadastrar entidade"}
        </Botao>
      </div>
    </form>
  );
}

export function FormVinculoEntidade({ acao, opcoes }: { acao: Acao; opcoes: { id: string; rotulo: string }[] }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro ? estado.valores ?? {} : {};
  if (opcoes.length === 0) return <p className="text-sm text-slate-500">Nenhum mandato cadastrado. Cadastre em Parlamentares e Mandatos.</p>;
  return (
    <form action={enviar} className="space-y-3">
      {estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div key={estado?.n ?? 0} className="space-y-3">
        <div>
          <Rotulo htmlFor="ent-mandato">Mandato *</Rotulo>
          <Selecao id="ent-mandato" name="mandatoId" required defaultValue={v.mandatoId ?? ""}>
            <option value="">Escolha…</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="ent-tipo">Relação *</Rotulo>
          <Selecao id="ent-tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
            <option value="">Escolha…</option>
            {TIPOS_PARTICIPACAO_DEMANDA.map((t) => <option key={t} value={t}>{ROTULO_PARTICIPACAO[t]} — {DESCRICAO_PARTICIPACAO[t]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="ent-obs">Observações</Rotulo>
          <Campo id="ent-obs" name="observacoes" maxLength={1000} defaultValue={v.observacoes} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Vincular mandato"}</Botao>
    </form>
  );
}

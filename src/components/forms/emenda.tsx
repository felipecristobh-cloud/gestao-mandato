"use client";

import { useActionState, type ReactNode } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { SelecaoBairro } from "@/components/forms/demanda";
import { ROTULO_DOCUMENTO, ROTULO_LANCAMENTO, ROTULO_STATUS_EMENDA, ROTULO_TIPO_EMENDA, STATUS_EMENDA, TIPOS_DOCUMENTO, TIPOS_EMENDA, TIPOS_LANCAMENTO } from "@/lib/emendas";
import { DESCRICAO_PARTICIPACAO, ESFERAS, ROTULO_ESFERA, ROTULO_PARTICIPACAO, TIPOS_PARTICIPACAO } from "@/lib/parlamentares";
import type { EstadoForm, Valores } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoForm, f: FormData) => Promise<EstadoForm>;

export type OpcoesFormEmenda = {
  orgaos: { id: number; nome: string; sigla: string | null }[];
  regionais: { id: number; nome: string; bairros: { id: number; nome: string }[] }[];
  responsaveis: { id: string; nome: string }[];
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

function Dinheiro(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">R$</span>
      <Campo inputMode="decimal" placeholder="0,00" pattern="[0-9.,]*" title="Use números, ex.: 150.000,00" {...p} className="pl-9" />
    </div>
  );
}

export function FormEmenda({ acao, opcoes, valores: iniciais, edicao }: { acao: Acao; opcoes: OpcoesFormEmenda; valores?: Valores; edicao?: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v: Valores = { ...iniciais, ...(estado?.valores ?? {}) };
  return (
    <form action={enviar} className="space-y-5">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <div key={estado?.n ?? 0} className="space-y-5">
        <Grupo titulo="Identificação">
          <div>
            <Rotulo htmlFor="esfera">Esfera *</Rotulo>
            <Selecao id="esfera" name="esfera" required defaultValue={v.esfera ?? ""}>
              <option value="">Escolha…</option>
              {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="tipo">Tipo *</Rotulo>
            <Selecao id="tipo" name="tipo" required defaultValue={v.tipo ?? "INDIVIDUAL"}>
              {TIPOS_EMENDA.map((t) => <option key={t} value={t}>{ROTULO_TIPO_EMENDA[t]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="numero">Número oficial</Rotulo>
            <Campo id="numero" name="numero" maxLength={40} placeholder="Vazio enquanto não protocolada" defaultValue={v.numero} />
          </div>
          <div>
            <Rotulo htmlFor="ano">Ano (exercício) *</Rotulo>
            <Campo id="ano" name="ano" type="number" min={2000} max={2100} required defaultValue={v.ano} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="objeto">Objeto *</Rotulo>
            <Area id="objeto" name="objeto" required minLength={10} maxLength={2000} defaultValue={v.objeto} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="justificativa">Justificativa</Rotulo>
            <Area id="justificativa" name="justificativa" maxLength={4000} defaultValue={v.justificativa} />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">
            O autor não é preenchido aqui: depois de salvar, vincule o mandato com participação &quot;Autor&quot;. Acompanhar ou articular não gera autoria.
          </p>
        </Grupo>

        <Grupo titulo="Valores">
          <div>
            <Rotulo htmlFor="valorIndicado">Valor indicado *</Rotulo>
            <Dinheiro id="valorIndicado" name="valorIndicado" required defaultValue={v.valorIndicado} />
          </div>
          <div>
            <Rotulo htmlFor="valorAprovado">Valor aprovado</Rotulo>
            <Dinheiro id="valorAprovado" name="valorAprovado" defaultValue={v.valorAprovado} />
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">Empenhado, liquidado e pago vêm dos lançamentos de execução, na página da emenda.</p>
        </Grupo>

        <Grupo titulo="Beneficiário e local">
          <div>
            <Rotulo htmlFor="beneficiario">Beneficiário</Rotulo>
            <Campo id="beneficiario" name="beneficiario" maxLength={200} defaultValue={v.beneficiario} />
          </div>
          <div>
            <Rotulo htmlFor="cnpj">CNPJ</Rotulo>
            <Campo id="cnpj" name="cnpj" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" defaultValue={v.cnpj} />
          </div>
          <div>
            <Rotulo htmlFor="municipio">Município</Rotulo>
            <Campo id="municipio" name="municipio" maxLength={80} defaultValue={v.municipio} />
          </div>
          <div>
            <Rotulo htmlFor="bairroId">Bairro / regional (BH)</Rotulo>
            <SelecaoBairro id="bairroId" name="bairroId" regionais={opcoes.regionais} defaultValue={v.bairroId ?? ""} />
          </div>
        </Grupo>

        <Grupo titulo="Execução orçamentária">
          <div>
            <Rotulo htmlFor="orgaoId">Órgão</Rotulo>
            <Selecao id="orgaoId" name="orgaoId" defaultValue={v.orgaoId ?? ""}>
              <option value="">—</option>
              {opcoes.orgaos.map((o) => <option key={o.id} value={o.id}>{o.sigla ? `${o.sigla} — ${o.nome}` : o.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="secretaria">Secretaria / unidade</Rotulo>
            <Campo id="secretaria" name="secretaria" maxLength={200} defaultValue={v.secretaria} />
          </div>
          <div>
            <Rotulo htmlFor="programa">Programa</Rotulo>
            <Campo id="programa" name="programa" maxLength={200} defaultValue={v.programa} />
          </div>
          <div>
            <Rotulo htmlFor="acaoOrcamentaria">Ação orçamentária</Rotulo>
            <Campo id="acaoOrcamentaria" name="acaoOrcamentaria" maxLength={200} defaultValue={v.acaoOrcamentaria} />
          </div>
        </Grupo>

        <Grupo titulo="Acompanhamento interno">
          <div>
            <Rotulo htmlFor="responsavelId">Responsável interno</Rotulo>
            <Selecao id="responsavelId" name="responsavelId" defaultValue={v.responsavelId ?? ""}>
              <option value="">—</option>
              {opcoes.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="prazo">Prazo</Rotulo>
            <Campo id="prazo" name="prazo" type="date" defaultValue={v.prazo} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="observacoes">Observações</Rotulo>
            <Area id="observacoes" name="observacoes" maxLength={4000} defaultValue={v.observacoes} />
          </div>
        </Grupo>
      </div>
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Cadastrar emenda"}</Botao>
      </div>
    </form>
  );
}

function useMiniForm(acao: Acao) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro ? estado?.valores ?? {} : {};
  const aviso = estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null;
  return { enviar, enviando, v, aviso, chave: estado?.n ?? 0 };
}

export function FormStatusEmenda({ acao, atual }: { acao: Acao; atual: string }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="space-y-3">
        <div>
          <Rotulo htmlFor="status">Novo status</Rotulo>
          <Selecao id="status" name="status" required defaultValue={v.status ?? ""}>
            <option value="">Escolha…</option>
            {STATUS_EMENDA.filter((s) => s !== atual).map((s) => <option key={s} value={s}>{ROTULO_STATUS_EMENDA[s]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="comentario">Motivo / comentário (obrigatório para cancelar ou impedimento técnico)</Rotulo>
          <Area id="comentario" name="comentario" rows={2} maxLength={2000} defaultValue={v.comentario} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Alterar status"}</Botao>
    </form>
  );
}

export function FormComentarioEmenda({ acao }: { acao: Acao }) {
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

export function FormLancamento({ acao, hoje }: { acao: Acao; hoje: string }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="l-tipo">Tipo *</Rotulo>
          <Selecao id="l-tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
            <option value="">Escolha…</option>
            {TIPOS_LANCAMENTO.map((t) => <option key={t} value={t}>{ROTULO_LANCAMENTO[t]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="l-valor">Valor *</Rotulo>
          <Dinheiro id="l-valor" name="valor" required defaultValue={v.valor} />
        </div>
        <div>
          <Rotulo htmlFor="l-data">Data *</Rotulo>
          <Campo id="l-data" name="data" type="date" required max={hoje} defaultValue={v.data ?? hoje} />
        </div>
        <div>
          <Rotulo htmlFor="l-doc">Documento (nº empenho, OB…)</Rotulo>
          <Campo id="l-doc" name="documento" maxLength={80} defaultValue={v.documento} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="l-obs">Observações</Rotulo>
          <Campo id="l-obs" name="observacoes" maxLength={1000} defaultValue={v.observacoes} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Registrar lançamento"}</Botao>
    </form>
  );
}

export function FormVinculoEmenda({ acao, opcoes }: { acao: Acao; opcoes: { id: string; rotulo: string }[] }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  if (opcoes.length === 0) return <p className="text-sm text-slate-500">Nenhum mandato cadastrado. Cadastre em Parlamentares e Mandatos.</p>;
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor="ve-mandato">Mandato *</Rotulo>
          <Selecao id="ve-mandato" name="mandatoId" required defaultValue={v.mandatoId ?? ""}>
            <option value="">Escolha…</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </Selecao>
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="ve-tipo">Participação *</Rotulo>
          <Selecao id="ve-tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
            <option value="">Escolha…</option>
            {TIPOS_PARTICIPACAO.map((t) => <option key={t} value={t}>{ROTULO_PARTICIPACAO[t]} — {DESCRICAO_PARTICIPACAO[t]}</option>)}
          </Selecao>
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="ve-resp">Responsabilidade</Rotulo>
          <Campo id="ve-resp" name="responsabilidade" maxLength={200} placeholder="Ex.: acompanhar o plano de trabalho na secretaria" defaultValue={v.responsabilidade} />
        </div>
        <div>
          <Rotulo htmlFor="ve-inicio">Início da participação</Rotulo>
          <Campo id="ve-inicio" name="dataInicio" type="date" defaultValue={v.dataInicio} />
        </div>
        <div>
          <Rotulo htmlFor="ve-fim">Fim da participação</Rotulo>
          <Campo id="ve-fim" name="dataFim" type="date" defaultValue={v.dataFim} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="ve-obs">Observações</Rotulo>
          <Campo id="ve-obs" name="observacoes" maxLength={1000} defaultValue={v.observacoes} />
        </div>
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Vincular mandato"}</Botao>
    </form>
  );
}

export function FormDocumentoEmenda({ acao }: { acao: Acao }) {
  const { enviar, enviando, v, aviso, chave } = useMiniForm(acao);
  return (
    <form action={enviar} className="space-y-3">
      {aviso}
      <div key={chave} className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="d-tipo">Tipo *</Rotulo>
          <Selecao id="d-tipo" name="tipo" required defaultValue={v.tipo ?? ""}>
            <option value="">Escolha…</option>
            {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{ROTULO_DOCUMENTO[t]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="d-numero">Número</Rotulo>
          <Campo id="d-numero" name="numero" maxLength={80} defaultValue={v.numero} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="d-desc">Descrição *</Rotulo>
          <Campo id="d-desc" name="descricao" required minLength={3} maxLength={300} defaultValue={v.descricao} />
        </div>
        <div>
          <Rotulo htmlFor="d-data">Data</Rotulo>
          <Campo id="d-data" name="data" type="date" defaultValue={v.data} />
        </div>
        <div>
          <Rotulo htmlFor="d-url">Link</Rotulo>
          <Campo id="d-url" name="url" type="url" maxLength={500} placeholder="https://" defaultValue={v.url} />
        </div>
      </div>
      <Botao type="submit" variante="secundario" disabled={enviando}>{enviando ? "Salvando…" : "Registrar documento"}</Botao>
    </form>
  );
}

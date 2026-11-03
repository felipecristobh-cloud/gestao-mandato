"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { ACEITAR, CATEGORIAS_DOCUMENTO, ROTULO_CATEGORIA, TAMANHO_MAX, formatarTamanho } from "@/lib/documentos";
import type { EstadoForm } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoForm, f: FormData) => Promise<EstadoForm>;

export function FormEnvioDocumento({ acao, podeRestrito, sufixo = "doc" }: { acao: Acao; podeRestrito: boolean; sufixo?: string }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const v = estado?.erro ? estado.valores ?? {} : {};
  return (
    <form action={enviar} className="space-y-3">
      {estado?.erro ? <Aviso>{estado.erro}</Aviso> : estado?.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div key={estado?.n ?? 0} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor={`${sufixo}-arquivo`}>Arquivo * (PDF, imagem, Word, Excel ou ODT, até {formatarTamanho(TAMANHO_MAX)})</Rotulo>
          <input id={`${sufixo}-arquivo`} name="arquivo" type="file" required accept={ACEITAR}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" />
        </div>
        <div>
          <Rotulo htmlFor={`${sufixo}-categoria`}>Tipo</Rotulo>
          <Selecao id={`${sufixo}-categoria`} name="categoria" defaultValue={v.categoria || "OUTRO"}>
            {CATEGORIAS_DOCUMENTO.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor={`${sufixo}-descricao`}>Descrição</Rotulo>
          <Campo id={`${sufixo}-descricao`} name="descricao" maxLength={500} defaultValue={v.descricao} />
        </div>
        {podeRestrito && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="restrito" value="1" className="h-4 w-4 rounded border-slate-300" />
            Restrito (só Admin e Coordenação abrem)
          </label>
        )}
      </div>
      <Botao type="submit" variante="secundario" disabled={enviando}>{enviando ? "Enviando…" : "Enviar documento"}</Botao>
    </form>
  );
}

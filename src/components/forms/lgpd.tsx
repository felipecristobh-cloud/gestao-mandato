"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import type { EstadoForm } from "@/server/services/parlamentares-actions";

type Acao = (e: EstadoForm, f: FormData) => Promise<EstadoForm>;

export function FormAnonimizar({ acao }: { acao: Acao }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-red-700">Anonimizar solicitante…</summary>
      <form action={enviar} className="mt-3 space-y-3">
        {estado?.erro && <Aviso>{estado.erro}</Aviso>}
        <p className="text-xs text-slate-600">
          Apaga nome, telefone, e-mail, endereço e ponto exato em todas as demandas desta pessoa, remove os arquivos anexados a
          elas e limpa esses dados da auditoria. Não dá pra desfazer. Confira a descrição e os comentários: texto livre não é limpo automaticamente.
        </p>
        <div>
          <Rotulo htmlFor="lgpd-motivo">Motivo *</Rotulo>
          <Campo id="lgpd-motivo" name="motivo" required minLength={5} maxLength={500} defaultValue={estado?.valores?.motivo} placeholder="Ex.: pedido do titular por e-mail em 05/10/2026" />
        </div>
        <div>
          <Rotulo htmlFor="lgpd-confirmar">Digite ANONIMIZAR para confirmar</Rotulo>
          <Campo id="lgpd-confirmar" name="confirmar" required autoComplete="off" />
        </div>
        <Botao type="submit" variante="perigo" disabled={enviando}>{enviando ? "Anonimizando…" : "Anonimizar"}</Botao>
      </form>
    </details>
  );
}

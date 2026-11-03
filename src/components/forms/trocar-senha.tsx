"use client";

import { useActionState } from "react";
import { trocarSenhaAction } from "@/server/auth/actions";
import { Aviso, Botao, Campo, Cartao, Rotulo } from "@/components/ui";

export function FormTrocarSenha({ obrigatoria }: { obrigatoria: boolean }) {
  const [estado, acao, enviando] = useActionState(trocarSenhaAction, undefined);
  return (
    <Cartao>
      <form action={acao} className="space-y-4">
        <h2 className="text-base font-semibold">Trocar senha</h2>
        {obrigatoria && <Aviso tipo="info">No primeiro acesso é obrigatório criar uma senha pessoal.</Aviso>}
        {estado?.erro && <Aviso>{estado.erro}</Aviso>}
        <div>
          <Rotulo htmlFor="atual">Senha atual</Rotulo>
          <Campo id="atual" name="atual" type="password" autoComplete="current-password" required />
        </div>
        <div>
          <Rotulo htmlFor="nova">Nova senha</Rotulo>
          <Campo id="nova" name="nova" type="password" autoComplete="new-password" minLength={10} required aria-describedby="regra-senha" />
          <p id="regra-senha" className="mt-1 text-xs text-slate-500">Mínimo de 10 caracteres, com letras e números.</p>
        </div>
        <div>
          <Rotulo htmlFor="confirmacao">Confirme a nova senha</Rotulo>
          <Campo id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
        </div>
        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar nova senha"}
        </Botao>
      </form>
    </Cartao>
  );
}

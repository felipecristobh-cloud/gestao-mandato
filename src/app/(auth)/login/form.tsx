"use client";

import { useActionState } from "react";
import { entrarAction } from "@/server/auth/actions";
import { Aviso, Botao, Campo, Cartao, Rotulo } from "@/components/ui";

export function FormLogin() {
  const [estado, acao, enviando] = useActionState(entrarAction, undefined);
  return (
    <Cartao>
      <form action={acao} className="space-y-4">
        {estado?.erro && <Aviso>{estado.erro}</Aviso>}
        <div>
          <Rotulo htmlFor="email">E-mail</Rotulo>
          <Campo id="email" name="email" type="email" autoComplete="username" required autoFocus={!estado?.email} defaultValue={estado?.email} />
        </div>
        <div>
          <Rotulo htmlFor="senha">Senha</Rotulo>
          <Campo id="senha" name="senha" type="password" autoComplete="current-password" required autoFocus={!!estado?.email} />
        </div>
        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Botao>
        <p className="text-center text-xs text-slate-500">Esqueceu a senha? Peça ao administrador para redefinir.</p>
      </form>
    </Cartao>
  );
}

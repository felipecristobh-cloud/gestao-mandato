"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import type { EstadoUsuario } from "@/server/services/usuarios-actions";

const PERFIS = [
  ["ASSESSOR", "Assessor — vê tudo, edita o que é seu"],
  ["COORDENACAO", "Coordenação — acesso amplo e relatórios"],
  ["CONSULTA", "Consulta — somente visualização"],
  ["ADMIN", "Administrador — acesso total"],
] as const;

type Valores = { nome: string; email: string; telefone: string | null; cargo: string | null; perfil: string; ativo?: boolean };

export function SenhaTemporaria({ senha, email }: { senha: string; email?: string }) {
  return (
    <Aviso tipo="ok">
      <p>Senha temporária{email ? ` de ${email}` : ""}: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-base">{senha}</code></p>
      <p className="mt-1 text-xs">Anote e entregue pessoalmente. Ela não aparece de novo e precisa ser trocada no primeiro acesso.</p>
    </Aviso>
  );
}

export function FormUsuario({
  acao,
  valores: iniciais,
  edicao,
}: {
  acao: (e: EstadoUsuario, f: FormData) => Promise<EstadoUsuario>;
  valores?: Valores;
  edicao?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  const valores = estado?.erro && estado.valores ? { ...iniciais, ...estado.valores } : iniciais;
  return (
    <form action={enviar} className="space-y-4">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && !estado.senhaTemporaria && <Aviso tipo="ok">{estado.ok}</Aviso>}
      {estado?.senhaTemporaria && <SenhaTemporaria senha={estado.senhaTemporaria} email={estado.email} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor="nome">Nome completo</Rotulo>
          <Campo id="nome" name="nome" required minLength={3} maxLength={120} defaultValue={valores?.nome} />
        </div>
        <div>
          <Rotulo htmlFor="email">E-mail</Rotulo>
          <Campo id="email" name="email" type="email" required maxLength={160} defaultValue={valores?.email} />
        </div>
        <div>
          <Rotulo htmlFor="telefone">Telefone</Rotulo>
          <Campo id="telefone" name="telefone" type="tel" maxLength={30} defaultValue={valores?.telefone ?? ""} />
        </div>
        <div>
          <Rotulo htmlFor="cargo">Cargo</Rotulo>
          <Campo id="cargo" name="cargo" maxLength={80} defaultValue={valores?.cargo ?? ""} />
        </div>
        <div>
          <Rotulo htmlFor="perfil">Perfil de acesso</Rotulo>
          <Selecao key={valores?.perfil} id="perfil" name="perfil" required defaultValue={valores?.perfil ?? "ASSESSOR"}>
            {PERFIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Selecao>
        </div>
        {edicao && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="ativo" defaultChecked={valores?.ativo} className="size-4 accent-marca-700" />
            Usuário ativo (desmarcar encerra as sessões e bloqueia o acesso)
          </label>
        )}
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Criar usuário"}</Botao>
    </form>
  );
}

export function BotaoRedefinirSenha({ acao }: { acao: (e: EstadoUsuario) => Promise<EstadoUsuario> }) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form
      action={enviar}
      onSubmit={(e) => {
        if (!confirm("Gerar uma nova senha temporária e encerrar as sessões deste usuário?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.senhaTemporaria && <SenhaTemporaria senha={estado.senhaTemporaria} />}
      <Botao type="submit" variante="secundario" disabled={enviando}>Redefinir senha</Botao>
    </form>
  );
}

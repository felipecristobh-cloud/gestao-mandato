import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/current";
import { pode, ROTULO_PERFIL } from "@/server/authz";
import { CabecalhoPagina, Cartao, classeBotao } from "@/components/ui";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const u = await exigirUsuario();
  return (
    <>
      <CabecalhoPagina titulo="Configurações" />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Cartao>
          <h2 className="text-base font-semibold">Minha conta</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="inline text-slate-500">Nome: </dt><dd className="inline">{u.nome}</dd></div>
            <div><dt className="inline text-slate-500">E-mail: </dt><dd className="inline">{u.email}</dd></div>
            <div><dt className="inline text-slate-500">Perfil: </dt><dd className="inline">{ROTULO_PERFIL[u.perfil]}</dd></div>
          </dl>
          <Link href="/trocar-senha" className={classeBotao("secundario", "mt-4")}>Trocar senha</Link>
        </Cartao>
        {pode(u, "auditoria:ver") && (
          <Cartao>
            <h2 className="text-base font-semibold">Auditoria</h2>
            <p className="mt-1 text-sm text-slate-600">Quem fez o quê e quando: logins, criações e alterações.</p>
            <Link href="/configuracoes/auditoria" className={classeBotao("secundario", "mt-4")}>Ver auditoria</Link>
          </Cartao>
        )}
      </div>
    </>
  );
}

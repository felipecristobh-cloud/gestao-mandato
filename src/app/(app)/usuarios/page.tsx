import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { listarUsuarios } from "@/server/services/usuarios";
import { ROTULO_PERFIL } from "@/server/authz";
import { CabecalhoPagina, Cartao, classeBotao, Selo } from "@/components/ui";

export const metadata: Metadata = { title: "Usuários" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function UsuariosPage() {
  const ator = await exigirPermissaoPagina("usuarios:gerenciar");
  const usuarios = await listarUsuarios(prisma, ator);
  const agora = Date.now();
  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao={`${usuarios.filter((u) => u.ativo).length} ativos de ${usuarios.length}`}
        acoes={<Link href="/usuarios/novo" className={classeBotao()}>+ Novo usuário</Link>}
      />
      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Usuários do sistema</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">E-mail</th>
              <th scope="col" className="px-4 py-3">Perfil</th>
              <th scope="col" className="px-4 py-3">Situação</th>
              <th scope="col" className="px-4 py-3">Último acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/usuarios/${u.id}`} className="font-medium text-marca-800 hover:underline">{u.nome}</Link>
                  {u.cargo && <p className="text-xs text-slate-500">{u.cargo}</p>}
                </td>
                <td className="px-4 py-3 text-slate-700">{u.email}</td>
                <td className="px-4 py-3"><Selo cor={u.perfil === "ADMIN" ? "azul" : "cinza"}>{ROTULO_PERFIL[u.perfil]}</Selo></td>
                <td className="px-4 py-3">
                  {!u.ativo ? <Selo cor="vermelho">Inativo</Selo>
                    : u.bloqueadoAte && u.bloqueadoAte.getTime() > agora ? <Selo cor="amarelo">Bloqueado</Selo>
                    : <Selo cor="verde">Ativo</Selo>}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.ultimoLogin ? fmt.format(u.ultimoLogin) : "Nunca"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

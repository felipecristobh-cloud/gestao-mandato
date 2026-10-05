import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/current";
import { ROTULO_PERFIL } from "@/server/authz";
import { Aviso, CabecalhoPagina, Cartao } from "@/components/ui";
import { MENU } from "@/components/layout/menu";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const u = await exigirUsuario();
  const { senha } = await searchParams;
  const modulos = MENU.filter((m) => m.fase).sort((a, b) => (a.fase ?? 0) - (b.fase ?? 0));
  return (
    <>
      <CabecalhoPagina titulo={`Olá, ${u.nome.split(" ")[0]}`} descricao={`Perfil: ${ROTULO_PERFIL[u.perfil]}`} />
      {senha === "ok" && <div className="mb-4"><Aviso tipo="ok">Senha alterada com sucesso.</Aviso></div>}
      <Cartao>
        <h2 className="text-base font-semibold">Fase 1 — Fundação</h2>
        <p className="mt-1 text-sm text-slate-600">
          Login, usuários, perfis de acesso, auditoria e navegação já funcionam. Os indicadores e gráficos do dashboard chegam na Fase 6.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {modulos.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                <span>{m.rotulo}</span>
                <span className="text-xs text-slate-500">Fase {m.fase}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Cartao>
    </>
  );
}

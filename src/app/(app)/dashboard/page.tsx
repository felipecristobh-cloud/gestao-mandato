import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/current";
import { prisma } from "@/server/db";
import { pode } from "@/server/authz";
import { contadoresDemandas } from "@/server/services/demandas";
import { ROTULO_PERFIL } from "@/server/authz";
import { Aviso, CabecalhoPagina, Cartao } from "@/components/ui";
import { MENU } from "@/components/layout/menu";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const u = await exigirUsuario();
  const { senha } = await searchParams;
  const c = pode(u, "dados:ver") ? await contadoresDemandas(prisma, u) : null;
  const cards = c ? [
    { rotulo: "Demandas abertas", valor: c.abertas, href: "/demandas?status=abertas", cor: "text-slate-900" },
    { rotulo: "Atrasadas", valor: c.atrasadas, href: "/demandas?prazo=atrasadas", cor: "text-red-700" },
    { rotulo: "Vencem em 7 dias", valor: c.vence7, href: "/demandas?prazo=7", cor: "text-amber-700" },
    { rotulo: "Sem responsável", valor: c.semResponsavel, href: "/demandas?status=abertas&responsavel=sem", cor: "text-slate-900" },
    { rotulo: "Minhas abertas", valor: c.minhas, href: "/demandas?status=abertas&responsavel=eu", cor: "text-marca-800" },
  ] : [];
  const modulos = MENU.filter((m) => m.fase).sort((a, b) => (a.fase ?? 0) - (b.fase ?? 0));
  return (
    <>
      <CabecalhoPagina titulo={`Olá, ${u.nome.split(" ")[0]}`} descricao={`Perfil: ${ROTULO_PERFIL[u.perfil]}`} />
      {senha === "ok" && <div className="mb-4"><Aviso tipo="ok">Senha alterada com sucesso.</Aviso></div>}
      {cards.length > 0 && (
        <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((k) => (
            <li key={k.rotulo}>
              <Link href={k.href} className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
                <span className={`block text-2xl font-semibold ${k.cor}`}>{k.valor}</span>
                <span className="text-xs text-slate-600">{k.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Cartao>
        <h2 className="text-base font-semibold">Próximos módulos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Demandas já funcionam. Os indicadores e gráficos completos do dashboard chegam na Fase 6.
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

import { LogOut } from "lucide-react";
import { exigirUsuario } from "@/server/auth/current";
import { pode, ROTULO_PERFIL } from "@/server/authz";
import { sairAction } from "@/server/auth/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { MENU } from "@/components/layout/menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const itens = MENU.filter((i) => !i.permissao || pode(u, i.permissao));

  const rodape = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-medium text-slate-900">{u.nome}</p>
      <p className="truncate text-xs text-slate-500">{ROTULO_PERFIL[u.perfil]}</p>
      <form action={sairAction} className="mt-3">
        <button type="submit" className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-100">
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="lg:flex">
      <Sidebar itens={itens} rodape={rodape} />
      <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}

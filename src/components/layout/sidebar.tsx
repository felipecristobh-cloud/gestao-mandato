"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2, CalendarDays, FileBarChart, FileText, Inbox, Landmark, LayoutDashboard, Map, Menu, Settings, UserCog, Users, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ItemMenu } from "./menu";

const ICONES = { Building2, CalendarDays, FileBarChart, FileText, Inbox, Landmark, LayoutDashboard, Map, Settings, UserCog, Users };

export function Sidebar({ itens, rodape }: { itens: ItemMenu[]; rodape: React.ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  const nav = (
    <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {itens.map((item) => {
        const Icone = ICONES[item.icone as keyof typeof ICONES];
        const ativo = caminho === item.href || caminho.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setAberto(false)}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
              ativo ? "bg-marca-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icone className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.rotulo}</span>
            {item.fase && <span className="text-[10px] font-normal uppercase text-neutral-500">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );

  const marca = (
    <div className="border-b border-neutral-800 px-5 py-4">
      <Image src="/logo-branca.png" alt="Pedro Patrus" width={669} height={353} className="h-auto w-28" />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Gestão do Mandato</p>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-white lg:hidden">
        <Image src="/logo-branca.png" alt="Pedro Patrus" width={669} height={353} className="h-auto w-20" />
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-md p-2 hover:bg-white/10"
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        {marca}
        {nav}
        {rodape}
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-neutral-950 shadow-xl">
            <div className="flex items-start justify-between">
              {marca}
              <button type="button" onClick={() => setAberto(false)} className="m-3 rounded-md p-2 text-white hover:bg-white/10" aria-label="Fechar menu">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {nav}
            {rodape}
          </aside>
        </div>
      )}
    </>
  );
}

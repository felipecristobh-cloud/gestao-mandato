"use client";

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
              ativo ? "bg-marca-50 text-marca-800" : "text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icone className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.rotulo}</span>
            {item.fase && <span className="text-[10px] font-normal uppercase text-slate-400">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );

  const marca = (
    <div className="border-b border-slate-200 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-marca-700">Mandato Pedro Patrus</p>
      <p className="text-sm font-semibold text-slate-900">Gestão do Mandato</p>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        <p className="text-sm font-semibold">Gestão do Mandato</p>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-md p-2 hover:bg-slate-100"
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh">
        {marca}
        {nav}
        {rodape}
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-start justify-between">
              {marca}
              <button type="button" onClick={() => setAberto(false)} className="m-3 rounded-md p-2 hover:bg-slate-100" aria-label="Fechar menu">
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

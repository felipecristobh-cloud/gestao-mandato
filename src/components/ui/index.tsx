import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca-700 text-white hover:bg-marca-800 focus-visible:outline-marca-700",
  secundario: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-marca-700",
  perigo: "bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700",
  fantasma: "text-slate-700 hover:bg-slate-100 focus-visible:outline-marca-700",
};

export function Botao({ variante = "primario", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTES[variante],
        className,
      )}
    />
  );
}

export function classeBotao(variante: Variante = "primario", className?: string) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2",
    VARIANTES[variante],
    className,
  );
}

export function Rotulo({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...p} className={cn("mb-1 block text-sm font-medium text-slate-700", className)} />;
}

const campo =
  "block w-full min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30 disabled:bg-slate-100";

export function Campo({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(campo, className)} />;
}

export function Selecao({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(campo, className)} />;
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok" | "info"; children: ReactNode }) {
  const cores = {
    erro: "border-red-200 bg-red-50 text-red-800",
    ok: "border-green-200 bg-green-50 text-green-800",
    info: "border-marca-100 bg-marca-50 text-marca-900",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", cores)}>
      {children}
    </div>
  );
}

export function Selo({ children, cor = "cinza" }: { children: ReactNode; cor?: "cinza" | "verde" | "vermelho" | "azul" | "amarelo" }) {
  const c = {
    cinza: "bg-slate-100 text-slate-700",
    verde: "bg-green-100 text-green-800",
    vermelho: "bg-red-100 text-red-800",
    azul: "bg-marca-100 text-marca-900",
    amarelo: "bg-amber-100 text-amber-900",
  }[cor];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", c)}>{children}</span>;
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-600">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  );
}

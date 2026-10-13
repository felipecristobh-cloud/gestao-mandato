import Link from "next/link";
import type { StatusCompromisso, TipoCompromisso } from "@prisma/client";
import { Cartao, Selo } from "@/components/ui";
import { COR_STATUS_COMPROMISSO, ROTULO_STATUS_COMPROMISSO, ROTULO_TIPO_COMPROMISSO, formatarPeriodo } from "@/lib/agenda";

type Item = { id: string; titulo: string; tipo: TipoCompromisso; status: StatusCompromisso; inicio: Date; fim: Date; resultado?: string | null };

/** Card "Agenda / reuniões" para páginas de entidade, demanda, emenda e parlamentar. */
export function CompromissosVinculados({ itens, novoHref, titulo = "Agenda / reuniões" }: { itens: Item[]; novoHref?: string; titulo?: string }) {
  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {novoHref && <Link href={novoHref} className="text-sm font-medium text-marca-800 hover:underline">+ Agendar</Link>}
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum compromisso vinculado.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((c) => (
            <li key={c.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/agenda/${c.id}`} className="font-medium text-marca-800 hover:underline">{c.titulo}</Link>
                <Selo cor={COR_STATUS_COMPROMISSO[c.status]}>{ROTULO_STATUS_COMPROMISSO[c.status]}</Selo>
                <span className="text-xs text-slate-500">{ROTULO_TIPO_COMPROMISSO[c.tipo]} · {formatarPeriodo(c.inicio, c.fim)}</span>
              </div>
              {c.resultado && <p className="line-clamp-2 text-slate-600">{c.resultado}</p>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

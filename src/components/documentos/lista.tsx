import Link from "next/link";
import { Selo } from "@/components/ui";
import { BotaoConfirmar } from "@/components/forms/parlamentar";
import { ROTULO_CATEGORIA, formatarTamanho } from "@/lib/documentos";
import { removerDocumentoAction } from "@/server/services/documentos-actions";
import type { DocumentoExibido } from "@/server/services/documentos";

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Vinculo({ d }: { d: DocumentoExibido }) {
  if (d.demandaId && d.demanda) return <Link href={`/demandas/${d.demandaId}`} className="hover:underline">Demanda {d.demanda.protocolo}</Link>;
  if (d.emendaId && d.emenda) return <Link href={`/emendas/${d.emendaId}`} className="hover:underline">Emenda {d.emenda.numero}/{d.emenda.ano}</Link>;
  if (d.entidadeId && d.entidade) return <Link href={`/entidades/${d.entidadeId}`} className="hover:underline">{d.entidade.nome}</Link>;
  return <>Avulso</>;
}

export function ListaDocumentos({ docs, mostrarVinculo = false }: { docs: DocumentoExibido[]; mostrarVinculo?: boolean }) {
  if (docs.length === 0) return <p className="text-sm text-slate-500">Nenhum arquivo enviado.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
          <div className="min-w-0 flex-1">
            {d.podeAbrir
              ? <a href={`/documentos/${d.id}/arquivo`} className="break-all font-medium text-marca-700 hover:underline">{d.nome}</a>
              : <span className="text-slate-500">{d.nome}</span>}
            {d.descricao && <p className="text-slate-600">{d.descricao}</p>}
            <p className="text-xs text-slate-500">
              {ROTULO_CATEGORIA[d.categoria]} · {formatarTamanho(d.tamanho)} · {d.usuario?.nome ?? "—"} · {fmt.format(d.criadoEm)}
              {mostrarVinculo && <> · <Vinculo d={d} /></>}
            </p>
          </div>
          {d.restrito && <Selo cor="vermelho">Restrito</Selo>}
          {d.podeRemover && <BotaoConfirmar acao={removerDocumentoAction.bind(null, d.id)} rotulo="Remover" pergunta="Remover este arquivo? Ele será apagado do armazenamento." />}
        </li>
      ))}
    </ul>
  );
}

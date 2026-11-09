import Link from "next/link";
import { prisma } from "@/server/db";
import { pode, type Ator } from "@/server/authz";
import { oportunidadesLigadas } from "@/server/services/oportunidades";
import { Cartao, Selo, classeBotao } from "@/components/ui";
import { COR_ETAPA, ROTULO_ETAPA } from "@/lib/oportunidades";

/** Propostas legislativas ligadas a uma demanda, emenda ou compromisso, com o atalho para criar uma nova a partir dele. */
export async function CartaoOportunidades({ ator, alvo, novaHref, rotuloNova }: {
  ator: Ator; alvo: { demandaId?: string; emendaId?: string; compromissoId?: string }; novaHref?: string; rotuloNova?: string;
}) {
  const itens = await oportunidadesLigadas(prisma, ator, alvo);
  return (
    <Cartao>
      <h2 className="mb-3 text-base font-semibold">Propostas legislativas</h2>
      {itens.length === 0 && <p className="text-sm text-slate-500">Nenhuma proposta ligada.</p>}
      <ul className="space-y-2">
        {itens.map((o) => (
          <li key={o.id} className="text-sm">
            <Link href={`/oportunidades/${o.id}`} className="font-medium text-marca-800 hover:underline">{o.nome}</Link>
            <div className="mt-1 flex flex-wrap gap-1">
              <Selo cor={COR_ETAPA[o.etapa]}>{ROTULO_ETAPA[o.etapa]}</Selo>
              {o.surgiuDaqui && <Selo cor="azul">Surgiu desta demanda</Selo>}
            </div>
          </li>
        ))}
      </ul>
      {novaHref && pode(ator, "dados:criar") && (
        <Link href={novaHref} className={`${classeBotao("secundario")} mt-4 w-full justify-center text-center`}>{rotuloNova ?? "+ Nova proposta"}</Link>
      )}
    </Cartao>
  );
}

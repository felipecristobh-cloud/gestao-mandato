import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { listarEixos } from "@/server/services/oportunidades";
import { alternarEixoAction, criarEixoAction } from "@/server/services/oportunidades-actions";
import { CabecalhoPagina, Cartao, Selo } from "@/components/ui";
import { BotaoAlternarEixo, FormEixo } from "@/components/forms/oportunidade";

export const metadata: Metadata = { title: "Eixos temáticos" };

export default async function EixosPage() {
  const ator = await exigirPermissaoPagina("cadastros_base:gerenciar");
  const eixos = await listarEixos(prisma, ator);
  return (
    <>
      <Link href="/oportunidades" className="text-sm text-slate-600 hover:underline">← Oportunidades Legislativas</Link>
      <CabecalhoPagina titulo="Eixos temáticos" descricao="Eixo inativo não aparece em cadastros novos, mas continua nas propostas que já usam ele." />
      <Cartao className="mb-4 max-w-2xl"><FormEixo acao={criarEixoAction} /></Cartao>
      <Cartao className="max-w-2xl p-0">
        <ul className="divide-y divide-slate-100">
          {eixos.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-slate-800">{e.nome} {!e.ativo && <Selo>Inativo</Selo>}</span>
              <span className="flex items-center gap-4 text-slate-500">
                {e._count.oportunidades} proposta{e._count.oportunidades === 1 ? "" : "s"}
                <BotaoAlternarEixo acao={alternarEixoAction.bind(null, e.id)} ativo={e.ativo} />
              </span>
            </li>
          ))}
        </ul>
      </Cartao>
    </>
  );
}

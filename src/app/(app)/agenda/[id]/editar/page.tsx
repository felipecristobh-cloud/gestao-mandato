import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesAgenda, podeConfirmarAgendaVereador } from "@/server/services/agenda";
import { atualizarCompromissoAction } from "@/server/services/agenda-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormCompromisso } from "@/components/forms/agenda";
import { paraDataHoraLocal } from "@/lib/agenda";
import { carregarCompromisso } from "../../carregar";

export const metadata: Metadata = { title: "Editar compromisso" };

export default async function EditarCompromissoPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const c = await carregarCompromisso(ator, id);
  if (!c.podeEditar) redirect(`/agenda/${c.id}`);
  const opcoes = await opcoesAgenda(prisma);
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const valores = {
    titulo: c.titulo, tipo: c.tipo, inicio: paraDataHoraLocal(c.inicio), fim: paraDataHoraLocal(c.fim), local: s(c.local), bairroId: s(c.bairroId),
    pauta: s(c.pauta), agendaVereador: c.agendaVereador ? "on" : "", responsavelId: s(c.responsavelId), participantes: c.participantes.map((p) => p.usuarioId).join(","),
  };
  const travado = c.agendaVereador && c.status === "CONFIRMADO" && !podeConfirmarAgendaVereador(ator);
  return (
    <>
      <Link href={`/agenda/${c.id}`} className="text-sm text-slate-600 hover:underline">← {c.titulo}</Link>
      <CabecalhoPagina
        titulo="Editar compromisso"
        descricao={travado ? "Confirmado na agenda do vereador: horário e agenda do vereador só mudam pela coordenação." : "Status, resultado e vínculos são alterados na página do compromisso."}
      />
      <Cartao className="max-w-3xl">
        <FormCompromisso acao={atualizarCompromissoAction.bind(null, c.id)} opcoes={opcoes} valores={valores} edicao podeConfirmarVereador={podeConfirmarAgendaVereador(ator)} />
      </Cartao>
    </>
  );
}

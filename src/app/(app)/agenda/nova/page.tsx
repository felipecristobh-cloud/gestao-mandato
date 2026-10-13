import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { opcoesAgenda, opcoesAlvos, podeConfirmarAgendaVereador } from "@/server/services/agenda";
import { criarCompromissoAction } from "@/server/services/agenda-actions";
import { CabecalhoPagina, Cartao } from "@/components/ui";
import { FormCompromisso } from "@/components/forms/agenda";
import { TIPOS_VINCULO } from "@/lib/agenda";

export const metadata: Metadata = { title: "Novo compromisso" };

export default async function NovoCompromissoPage({ searchParams }: { searchParams: Promise<{ data?: string; vinculo?: string }> }) {
  const ator = await exigirPermissaoPagina("dados:criar");
  const sp = await searchParams;
  const [opcoes, alvos] = await Promise.all([opcoesAgenda(prisma), opcoesAlvos(prisma)]);
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : null;
  const [tipoAlvo, idAlvo] = (sp.vinculo ?? "").split(":");
  const vinculo = (TIPOS_VINCULO as readonly string[]).includes(tipoAlvo) && /^[0-9a-f-]{36}$/i.test(idAlvo ?? "") ? sp.vinculo! : "";
  const rotuloVinculo = vinculo ? alvos.flatMap((g) => g.opcoes.map((o) => ({ ...o, grupo: g.rotulo }))).find((o) => o.valor === vinculo) : null;
  const valores = {
    responsavelId: ator.perfil === "CONSULTA" ? "" : ator.id,
    tipo: tipoAlvo === "entidade" ? "REUNIAO_ENTIDADE" : "",
    ...(data ? { inicio: `${data}T09:00`, fim: `${data}T10:00` } : {}),
    ...(vinculo ? { vinculo } : {}),
  };
  return (
    <>
      <Link href="/agenda" className="text-sm text-slate-600 hover:underline">← Agenda</Link>
      <CabecalhoPagina
        titulo="Novo compromisso"
        descricao={rotuloVinculo ? `Vinculado a ${rotuloVinculo.grupo.toLowerCase()}: ${rotuloVinculo.rotulo}` : "O sistema avisa se houver choque de horário com as mesmas pessoas."}
      />
      <Cartao className="max-w-3xl">
        <FormCompromisso acao={criarCompromissoAction} opcoes={opcoes} alvos={alvos} valores={valores} podeConfirmarVereador={podeConfirmarAgendaVereador(ator)} />
      </Cartao>
    </>
  );
}

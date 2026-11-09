import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { obterProposicao } from "@/server/services/proposicoes";
import { CabecalhoPagina, Cartao, Selo, classeBotao } from "@/components/ui";
import {
  COR_VERIFICACAO, ROTULO_PARTICIPACAO_PROPOSICAO, ROTULO_TIPO_PROPOSICAO, ROTULO_VERIFICACAO, mandatoDoAno, rotuloMandatoPedro, rotuloProposicao,
} from "@/lib/proposicoes";

export const metadata: Metadata = { title: "Proposição" };

const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const dia = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null);

function Item({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase text-slate-500">{rotulo}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-800">{children || "—"}</dd>
    </div>
  );
}

export default async function ProposicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const { id } = await params;
  const p = await obterProposicao(prisma, ator, id).catch((e) => {
    if (e instanceof AppError && e.code === "NAO_ENCONTRADO") notFound();
    throw e;
  });
  const mandato = mandatoDoAno(p.ano);
  return (
    <>
      <Link href="/oportunidades/historico" className="text-sm text-slate-600 hover:underline">← Histórico legislativo</Link>
      <CabecalhoPagina
        titulo={`${ROTULO_TIPO_PROPOSICAO[p.tipo]} ${p.numero}/${p.ano}`}
        descricao={`${rotuloProposicao(p)}${mandato ? ` · ${rotuloMandatoPedro(mandato)}` : ""}`}
        acoes={p.podeEditar ? <Link href={`/oportunidades/historico/${id}/editar`} className={classeBotao("secundario")}>Editar</Link> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item rotulo="Ementa" largo>{p.ementa}</Item>
              <Item rotulo="Autoria / participação">{ROTULO_PARTICIPACAO_PROPOSICAO[p.participacao]}</Item>
              <Item rotulo="Demais parlamentares">{p.parlamentares}</Item>
              <Item rotulo="Eixo temático">{p.eixo?.nome}</Item>
              <Item rotulo="Data de apresentação">{dia(p.dataApresentacao)}</Item>
              <Item rotulo="Situação atual">{p.situacao}</Item>
              <Item rotulo="Data de aprovação ou arquivamento">{dia(p.dataConclusao)}</Item>
              <Item rotulo="Lei correspondente">{p.lei}</Item>
              <Item rotulo="Resultado das votações">{p.resultadoVotacao}</Item>
              <Item rotulo="Descrição completa" largo>{p.descricao}</Item>
              <Item rotulo="Justificativa original" largo>{p.justificativa}</Item>
              <Item rotulo="Comissões" largo>{p.comissoes}</Item>
              <Item rotulo="Pareceres" largo>{p.pareceres}</Item>
              <Item rotulo="Observações internas" largo>{p.observacoes}</Item>
            </dl>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Histórico</h2>
            <ol className="space-y-2 text-sm">
              {p.historico.map((h) => (
                <li key={h.id} className="border-l-2 border-marca-200 pl-3">
                  <p className="text-slate-800">{h.descricao}</p>
                  <p className="text-xs text-slate-500">{data(h.data)}{h.usuario ? ` · ${h.usuario.nome}` : ""}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
        <Cartao>
          <h2 className="text-base font-semibold text-slate-900">Fonte e verificação</h2>
          <p className="mt-2"><Selo cor={COR_VERIFICACAO[p.verificacao]}>{ROTULO_VERIFICACAO[p.verificacao]}</Selo></p>
          <dl className="mt-3 space-y-3">
            <Item rotulo="Fonte">{p.fonte}</Item>
            <Item rotulo="Documento oficial">
              {p.linkOficial ? <a href={p.linkOficial} target="_blank" rel="noopener noreferrer" className="break-all text-marca-800 hover:underline">{p.linkOficial}</a> : null}
            </Item>
            <Item rotulo="Cadastrada por">{p.criadoPor ? `${p.criadoPor.nome} em ${data(p.criadoEm)}` : data(p.criadoEm)}</Item>
          </dl>
        </Cartao>
      </div>
    </>
  );
}

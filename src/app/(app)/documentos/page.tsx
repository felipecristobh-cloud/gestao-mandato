import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { pode } from "@/server/authz";
import { listarDocumentos } from "@/server/services/documentos";
import { enviarDocumentoAction } from "@/server/services/documentos-actions";
import { CabecalhoPagina, Cartao, Campo, Rotulo, Selecao, classeBotao } from "@/components/ui";
import { ListaDocumentos } from "@/components/documentos/lista";
import { FormEnvioDocumento } from "@/components/documentos/form-envio";
import { CATEGORIAS_DOCUMENTO, ROTULO_CATEGORIA } from "@/lib/documentos";

export const metadata: Metadata = { title: "Documentos" };

type Busca = { q?: string; categoria?: string; vinculo?: string; pagina?: string };

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const ator = await exigirPermissaoPagina("dados:ver");
  const sp = await searchParams;
  const lista = await listarDocumentos(prisma, ator, { ...sp, pagina: Number(sp.pagina) || 1 });
  const link = (extra: Busca) => `/documentos?${new URLSearchParams(Object.entries(extra).filter(([, v]) => v) as [string, string][])}`;
  const filtrando = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <>
      <CabecalhoPagina
        titulo="Documentos"
        descricao={`${lista.total} arquivo${lista.total === 1 ? "" : "s"}${filtrando ? " com os filtros escolhidos" : ""}. Os arquivos ficam criptografados e só abrem com login.`}
      />

      <Cartao className="mb-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="q">Buscar</Rotulo>
            <Campo id="q" name="q" defaultValue={sp.q} placeholder="Nome do arquivo ou descrição" />
          </div>
          <div>
            <Rotulo htmlFor="f-categoria">Tipo</Rotulo>
            <Selecao id="f-categoria" name="categoria" defaultValue={sp.categoria ?? ""}>
              <option value="">Todos</option>
              {CATEGORIAS_DOCUMENTO.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="f-vinculo">Ligado a</Rotulo>
            <Selecao id="f-vinculo" name="vinculo" defaultValue={sp.vinculo ?? ""}>
              <option value="">Qualquer</option>
              <option value="demanda">Demandas</option>
              <option value="emenda">Emendas</option>
              <option value="entidade">Entidades</option>
              <option value="avulso">Avulsos</option>
            </Selecao>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {filtrando && <Link href="/documentos" className={classeBotao("fantasma")}>Limpar filtros</Link>}
            <button type="submit" className={classeBotao()}>Filtrar</button>
          </div>
        </form>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <ListaDocumentos docs={lista.itens} mostrarVinculo />
          {lista.paginas > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              {lista.pagina > 1 ? <Link href={link({ ...sp, pagina: String(lista.pagina - 1) })} className="hover:underline">← Anterior</Link> : <span />}
              <span className="text-slate-500">Página {lista.pagina} de {lista.paginas}</span>
              {lista.pagina < lista.paginas ? <Link href={link({ ...sp, pagina: String(lista.pagina + 1) })} className="hover:underline">Próxima →</Link> : <span />}
            </div>
          )}
        </Cartao>
        {pode(ator, "dados:criar") && (
          <Cartao>
            <h2 className="mb-1 text-base font-semibold">Enviar documento avulso</h2>
            <p className="mb-3 text-xs text-slate-500">Para anexar a uma demanda, emenda ou entidade, use o cartão Arquivos na página dela.</p>
            <FormEnvioDocumento acao={enviarDocumentoAction.bind(null, "", "")} podeRestrito={pode(ator, "documentos_restritos:ver")} />
          </Cartao>
        )}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { listarAuditoria } from "@/server/services/usuarios";
import { CabecalhoPagina, Cartao, classeBotao } from "@/components/ui";

export const metadata: Metadata = { title: "Auditoria" };

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });
const ROTULO_ACAO: Record<string, string> = {
  CRIAR: "Criou", EDITAR: "Editou", EXCLUIR: "Excluiu", VISUALIZAR_SENSIVEL: "Visualizou dado sensível",
  EXPORTAR: "Exportou", LOGIN: "Entrou", LOGIN_FALHA: "Falha de login", LOGOUT: "Saiu",
};

function resumo(v: unknown) {
  if (!v || typeof v !== "object") return "";
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${JSON.stringify(x)}`).join(" · ");
}

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const ator = await exigirPermissaoPagina("auditoria:ver");
  const pagina = Number((await searchParams).pagina) || 1;
  const { itens, total, paginas } = await listarAuditoria(prisma, ator, { pagina });
  return (
    <>
      <Link href="/configuracoes" className="text-sm text-slate-600 hover:underline">← Configurações</Link>
      <CabecalhoPagina titulo="Auditoria" descricao={`${total} registros. Somente leitura: ninguém edita ou apaga pela aplicação.`} />
      <Cartao className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Registro de auditoria</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Data</th>
              <th scope="col" className="px-4 py-3">Usuário</th>
              <th scope="col" className="px-4 py-3">Ação</th>
              <th scope="col" className="px-4 py-3">Registro</th>
              <th scope="col" className="px-4 py-3">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmt.format(a.data)}</td>
                <td className="px-4 py-2">{a.usuario?.nome ?? "—"}</td>
                <td className="px-4 py-2">{ROTULO_ACAO[a.acao] ?? a.acao}</td>
                <td className="px-4 py-2 text-slate-600">{a.entidade}</td>
                <td className="max-w-md px-4 py-2 text-xs text-slate-600">
                  {a.descricao}
                  {a.valorNovo ? <span className="block break-words">{resumo(a.valorAnterior)} {a.valorAnterior ? "→ " : ""}{resumo(a.valorNovo)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
      <div className="mt-4 flex items-center gap-2 text-sm">
        {pagina > 1 && <Link className={classeBotao("secundario")} href={`?pagina=${pagina - 1}`}>Anterior</Link>}
        <span className="text-slate-600">Página {pagina} de {paginas}</span>
        {pagina < paginas && <Link className={classeBotao("secundario")} href={`?pagina=${pagina + 1}`}>Próxima</Link>}
      </div>
    </>
  );
}

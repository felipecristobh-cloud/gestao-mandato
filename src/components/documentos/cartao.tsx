import { Cartao } from "@/components/ui";
import { prisma } from "@/server/db";
import { pode, type Ator } from "@/server/authz";
import { documentosDe, type TipoVinculo } from "@/server/services/documentos";
import { enviarDocumentoAction } from "@/server/services/documentos-actions";
import { FormEnvioDocumento } from "./form-envio";
import { ListaDocumentos } from "./lista";

/** Arquivos anexados a uma demanda, emenda ou entidade. */
export async function CartaoDocumentos({ ator, tipo, id, podeAnexar, titulo = "Arquivos" }: { ator: Ator; tipo: TipoVinculo; id: string; podeAnexar: boolean; titulo?: string }) {
  const docs = await documentosDe(prisma, ator, { tipo, id });
  return (
    <Cartao>
      <h2 className="mb-3 text-base font-semibold">{titulo}</h2>
      <ListaDocumentos docs={docs} />
      {podeAnexar && pode(ator, "dados:criar") && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FormEnvioDocumento acao={enviarDocumentoAction.bind(null, tipo, id)} podeRestrito={pode(ator, "documentos_restritos:ver")} sufixo={`doc-${tipo}`} />
        </div>
      )}
    </Cartao>
  );
}

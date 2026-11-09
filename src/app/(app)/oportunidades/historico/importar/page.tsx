import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/server/auth/current";
import { importarAction, lerPlanilhaAction, reconferirAction } from "@/server/services/proposicoes-actions";
import { Aviso, CabecalhoPagina, Cartao } from "@/components/ui";
import { ImportadorProposicoes } from "@/components/forms/proposicao";
import { ANO_MAX, ANO_MIN } from "@/lib/proposicoes";

export const metadata: Metadata = { title: "Importar histórico legislativo" };

export default async function ImportarPage() {
  await exigirPermissaoPagina("dados:criar");
  return (
    <>
      <Link href="/oportunidades/historico" className="text-sm text-slate-600 hover:underline">← Histórico legislativo</Link>
      <CabecalhoPagina titulo="Importar planilha" descricao="Nada é gravado antes de você conferir e confirmar." />
      <div className="mb-4 space-y-2">
        <Aviso tipo="info">
          Colunas obrigatórias: Tipo (PL, PR, REQ, IND, PI, EMD, EO ou por extenso), Número, Ano ({ANO_MIN} a {ANO_MAX}), Ementa, Autoria (autoria, coautoria,
          emenda ou discussão) e Fonte. Sem a coluna Verificação, a linha entra como &quot;Aguardando conferência&quot;.{" "}
          <a href="/oportunidades/historico/modelo.csv" className="font-medium underline">Baixar modelo (.csv)</a>
        </Aviso>
        <p className="text-xs text-slate-500">
          A Câmara de BH não oferece API pública para baixar proposições. Por isso a importação é feita por planilha e o sistema não coleta dados do portal sozinho.
        </p>
      </div>
      <Cartao><ImportadorProposicoes ler={lerPlanilhaAction} reconferir={reconferirAction} importar={importarAction} /></Cartao>
    </>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade" };

const CONTATO = "felipe.cristo.bh@gmail.com";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm leading-relaxed text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-marca-700">Mandato Pedro Patrus</p>
      <h1 className="text-xl font-semibold text-slate-900">Política de Privacidade — Gestão do Mandato</h1>
      <p>
        O Gestão do Mandato é o sistema interno do gabinete do vereador Pedro Patrus (Câmara Municipal de Belo Horizonte)
        para organizar demandas de cidadãos, emendas parlamentares, entidades, agenda e documentos. O acesso é restrito à
        equipe do gabinete, com contas criadas pelo administrador.
      </p>
      <h2 className="font-semibold text-slate-900">Dados tratados</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Equipe: nome, e-mail, perfil de acesso e registros de acesso (data, IP e navegador).</li>
        <li>Cidadãos atendidos: nome, contato, endereço e o conteúdo da demanda, informados no atendimento.</li>
        <li>
          Login com Google: recebemos apenas o e-mail e o nome da conta Google para conferir se a pessoa já está
          cadastrada. Não acessamos Gmail, contatos, arquivos nem outros dados da conta.
        </li>
      </ul>
      <h2 className="font-semibold text-slate-900">Finalidade e base legal (LGPD)</h2>
      <p>
        Os dados são usados só para atender e acompanhar as demandas e para a gestão do mandato, no exercício da função
        parlamentar. Não são vendidos, não são usados para publicidade e não se misturam com bases de campanha eleitoral.
      </p>
      <h2 className="font-semibold text-slate-900">Segurança e retenção</h2>
      <p>
        O acesso é controlado por perfil, todas as ações ficam em auditoria, os documentos são guardados criptografados e
        os backups são cifrados. A pedido do titular, os dados pessoais podem ser anonimizados.
      </p>
      <h2 className="font-semibold text-slate-900">Seus direitos</h2>
      <p>
        Para acessar, corrigir ou pedir a exclusão/anonimização dos seus dados, escreva para{" "}
        <a className="text-marca-700 underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>
    </main>
  );
}

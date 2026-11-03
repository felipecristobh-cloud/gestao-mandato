# ADR 0007 — Dashboard (Fase 6)

## Contexto
O dashboard é a primeira tela do sistema. Ele precisa mostrar números de demandas e emendas, gráficos que levam à lista filtrada e uma seção de pontos de atenção.

## Decisões
- **Cálculo no servidor, a cada acesso.** `indicadoresDashboard` e `pontosDeAtencao` (`src/server/services/dashboard.ts`) usam `groupBy`/`count` do Prisma e algumas consultas SQL de agregação (regional, mês, tempo médio, valores por esfera, emendas por parlamentar). Não existe cache nem tabela de resumo: qualquer alteração aparece no próximo carregamento.
- **Gráficos com Recharts** (`src/components/dashboard/graficos.tsx`, client component). O servidor manda só os números agregados, sem dados pessoais. Clicar numa barra ou fatia abre a lista já filtrada (`/demandas?...`, `/emendas?...`).
- **Filtros.**
  - Demandas: data de entrada (últimos 12 meses — mês atual + 11 anteriores —, este ano ou todo o período).
  - Emendas: ano da emenda.
  - "Só as minhas": filtra pelo responsável = usuário logado.
  - Para os links dos gráficos funcionarem, as listas ganharam os filtros `entradaDe`, `orgaoId` e `retorno=pendente` (Demandas) e `alerta=parada|prazo` (Emendas).
- **Definições.**
  - Concluídas: resolvida, não resolvida ou cancelada. Taxa de conclusão = concluídas ÷ total do período.
  - Tempo médio de resolução: média de `data_conclusao − data_entrada`, só das resolvidas.
  - Atrasadas: demandas abertas com prazo vencido, de todo o período.
  - Valor total: aprovado ou, se ainda não houver, indicado; não inclui as canceladas. Execução = pago ÷ valor total. Pendente = valor total − pago.
  - Emendas por mandato: cada emenda conta uma vez por parlamentar, separando autor/coautor de outras participações (autoria nunca é inferida).
- **Pontos de atenção** (situação atual, não dependem do período):
  - demandas atrasadas;
  - demandas que vencem em 7 dias;
  - demandas sem responsável;
  - demandas aguardando retorno (status ou encaminhamento sem retorno);
  - emendas sem movimentação há 60 dias (nenhum histórico ou lançamento);
  - emendas com prazo vencido ou nos próximos 30 dias;
  - emendas com impedimento técnico;
  - agenda do vereador aguardando confirmação.

  As listas mostram até 6 itens, o total e um link para a lista completa. Não exibem o solicitante.
- **Permissões.** Quem tem `dados:ver` (todos os perfis) vê o dashboard. Os números agregados não têm dados pessoais.

## Fora desta fase
Exportação (Fase 7 — Relatórios), mapa (Fase 8), metas e comparação entre períodos.

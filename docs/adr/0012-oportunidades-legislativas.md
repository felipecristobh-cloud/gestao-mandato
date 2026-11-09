# ADR 0012 — Banco de Oportunidades Legislativas (Etapa 1: ideias e avaliação)

## Contexto
O gabinete quer guardar ideias de projetos, avaliar o impacto e decidir o que priorizar, sem misturar isso com demandas nem com o histórico oficial da Câmara.

## Decisão
- Tabelas novas, sem alterar as existentes: `eixo_legislativo`, `oportunidade`, `oportunidade_bairro`, `oportunidade_regional` e `oportunidade_historico`. Todas com RLS.
- Os eixos são separados dos temas de demanda, porque a lista pedida é outra (22 eixos). Eles são criados pelos cadastros base no deploy. Admin e Coordenação criam e inativam eixos em `/oportunidades/eixos`.
- Avaliação: 5 critérios de 0 a 5 com pesos 30/20/20/15/15. A nota final (0–100) é calculada no servidor (`calcularNotaFinal`) e guardada em `nota_final` para ordenar e filtrar.
- Faixas: 80–100 máxima, 60–79 alta, 40–59 intermediária e 0–39 baixa. A prioridade manual prevalece sobre a calculada, exige justificativa e só Admin/Coordenação podem definir. Voltar para automática também exige justificativa.
- Permissões seguem a matriz atual: Consulta só lê; Assessor cria e edita/avalia o que cadastrou ou de que é responsável; Coordenação e Admin editam tudo.
- Cada criação, edição, avaliação e mudança de prioridade gera linha no histórico da proposta e no `audit_log`.
- O aviso "nota alta não é parecer jurídico" aparece junto da avaliação.

## Próximas etapas
2. Fluxo de 14 etapas, textos versionados, anexos e "Transformar demanda em proposta".
3. Histórico legislativo (2013–2016, 2017–2020, 2021–2024 e 2025–2028) com fonte e verificação, e importação CSV/Excel.
4. Painel e relatórios.

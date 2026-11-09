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

## Etapa 2: desenvolvimento e integração
- `oportunidade.etapa` guarda as 14 etapas (`EtapaOportunidade`). A movimentação é livre, porque uma proposta pode voltar para revisão. A partir de "Aprovada internamente", e também para arquivar ou suspender, só Admin e Coordenação mudam a etapa (`ETAPAS_COORDENACAO`). Toda mudança fica no histórico e no `audit_log`. As etapas são registro interno do gabinete: nada é protocolado nem enviado à Câmara.
- Textos do projeto: `oportunidade_texto` tem 7 tipos, e cada salvamento cria uma versão (`versao` sequencial, com `@@unique` contra corrida, autor e data). Nada é sobrescrito. Só a coordenação grava a "versão final aprovada". A auditoria registra tipo, versão e tamanho, não o texto inteiro.
- Anexos: o mesmo módulo de Documentos, com a coluna `documento.oportunidade_id`. O CHECK `documento_um_vinculo` passa a incluir essa coluna. Novas categorias: `ESTUDO` e `MINUTA`.
- Vínculos: `oportunidade_vinculo` liga a proposta a exatamente um destes registros: demanda, emenda ou compromisso (CHECK). A demanda é buscada pelo protocolo. As páginas de demanda, emenda e agenda mostram as propostas ligadas.
- "Transformar demanda em proposta legislativa" abre `/oportunidades/nova?demanda=<id>` já preenchido com tema, descrição, bairro e regional. Nome e contato do cidadão não são copiados. A demanda não é alterada, e `oportunidade.demanda_origem_id` marca a origem, que não pode ser desvinculada. O mesmo atalho existe a partir de um compromisso da agenda, como uma audiência pública.

## Próximas etapas
3. Histórico legislativo (2013–2016, 2017–2020, 2021–2024 e 2025–2028) com fonte e verificação, e importação CSV/Excel.
4. Painel e relatórios.

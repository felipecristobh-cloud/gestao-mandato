# ADR 0005 — Emendas (Fase 4)

## Contexto
Emendas são o "recurso" da cadeia problema → atuação → articulação → recurso → execução → resultado. Podem ser municipais, estaduais ou federais, envolvem vários mandatos com papéis diferentes e têm execução financeira em etapas.

## Decisões
- **Identificação.** Código interno `EME-AAAA-NNNNN` (tabela `emenda_seq`, igual ao protocolo das demandas). O número oficial é opcional (emenda em negociação ainda não tem) e único por esfera + ano.
- **Dinheiro em centavos.** Colunas `NUMERIC(14,2)`; no código tudo é convertido para centavos inteiros (`src/lib/emendas.ts`), sem ponto flutuante. Formulários aceitam `1.234,56`.
- **Indicado e aprovado são digitados; empenhado, liquidado e pago são derivados** da soma dos lançamentos (`emenda_lancamento`: tipo, valor, data, documento). Cada lançamento trava a linha da emenda (`FOR UPDATE`), recalcula os totais e só grava se `pago ≤ liquidado ≤ empenhado ≤ aprovado`. O banco repete a regra com `CHECK`. Excluir um lançamento que quebraria a regra é recusado.
- **Saldos calculados, não guardados:** saldo = empenhado − pago (decisão da Fase 0), falta empenhar = (aprovado ou, sem ele, indicado) − empenhado, a liquidar = empenhado − liquidado.
- **Status.** Os 13 do prompt. Cancelada e Impedimento técnico exigem motivo. Empenhada/Liquidada/Paga exigem o lançamento correspondente. O primeiro empenho move automaticamente para Empenhada quando a emenda ainda está em fase anterior. Não há outras transições automáticas.
- **Emenda ↔ mandato.** `emenda_mandato` (muitos-para-muitos) com tipo de participação, responsabilidade, início/fim e observações; único por emenda + mandato + tipo.
- **Autoria explícita.** Não há campo "autor" na emenda: o autor é o vínculo `AUTOR`. Índice único parcial garante no máximo um autor. Autor/coautor precisam de mandato da mesma esfera da emenda e em exercício no ano dela; o mesmo mandato não pode ser autor e coautor. O mandato próprio pode ter qualquer papel, mas nada é atribuído automaticamente.
- **Documentos.** Nesta fase só referências (tipo, descrição, número, data, link http/https). Upload fica para o módulo Documentos.
- **Beneficiário** é texto + CNPJ; passa a apontar para Entidades na Fase 5.
- **Rede de Mandatos.** Agrupa as emendas com vínculo do mandato próprio por parlamentar parceiro. Emenda com vários parceiros aparece em cada um; os totais gerais contam cada emenda uma vez.
- **Permissões.** Ver: todos. Cadastrar: Admin, Coordenação, Assessor. Editar, mudar status, lançar execução, vincular mandatos e documentos: Admin/Coordenação em todas; Assessor nas que cadastrou ou das quais é responsável interno. Tudo checado nos services.
- **Histórico e auditoria.** `emenda_historico` (cadastro, edição, status, responsável, execução, mandatos, documento, comentário) e `audit_log` na mesma transação.
- Mandato com emendas vinculadas não pode ser excluído.

## Fora desta fase
Upload de documentos, ligação com Entidades, alertas de prazo de emenda no dashboard, importação de dados oficiais (SIOP, SIGCON etc.).

# ADR 0008 — Relatórios (Fase 7)

## Contexto
O prompt pede 17 relatórios exportáveis em PDF, Excel e CSV, sobre demandas e emendas.

## Decisões
- **Um só modelo de relatório.** `gerarRelatorio` (`src/server/services/relatorios.ts`) devolve um `Relatorio` com título, filtros descritos, colunas tipadas (`texto`, `inteiro`, `moeda` em centavos, `data`, `percentual`) e linhas. Os três formatos são gerados a partir desse mesmo objeto, então a prévia, o CSV, o Excel e o PDF sempre trazem os mesmos números.
- **Geração no servidor.**
  - CSV: `paraCSV`, em `src/lib/relatorios.ts`.
  - Excel: ExcelJS, em `src/server/relatorios/excel.ts`.
  - PDF: PDFKit, em `src/server/relatorios/pdf.ts`.

  O download sai pela rota `GET /relatorios/exportar?tipo=…&formato=csv|xlsx|pdf&<filtros>`.
- **Excel funcional.** Valores saem como número com formato R$. As colunas de percentual e a linha de total são fórmulas (`SUM`, `IF(den=0,"",num/den)`), então editar a planilha recalcula. Também tem cabeçalho congelado e autofiltro.
- **CSV** no padrão do Excel brasileiro: `;`, vírgula decimal, BOM UTF-8. Células que começam com `= + - @` são prefixadas com `'` para evitar injeção de fórmula.
- **Agrupamentos com sobreposição.** Nos relatórios por parlamentar (autor/coautor) e por mandato/participação, uma emenda pode aparecer em mais de uma linha, por isso esses dois não têm linha de total.
- **Canceladas.** Os relatórios de emenda excluem canceladas por padrão. Para incluí-las, use o status "todos, com canceladas".
- **Dados pessoais.**
  - Só as listas de demandas (atrasadas e resolvidas) podem trazer nome e telefone do solicitante.
  - Isso exige `relatorios:exportar_com_dados_pessoais` (Admin/Coordenação) e marcação explícita (`pessoais=1`).
  - Para os outros perfis, o parâmetro é ignorado no servidor.
- **Auditoria.** Cada download grava `EXPORTAR` em `audit_log`, com tipo, formato, filtros, número de linhas e se havia dados pessoais.
- **Limite** de 10.000 linhas por arquivo (avisado no relatório).

## Fora desta fase
Agendamento ou envio por e-mail, relatórios personalizados e gráficos dentro do PDF.

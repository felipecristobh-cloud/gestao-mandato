# ADR 0006 — Entidades e Agenda (Fase 5)

## Contexto
Entidades (associações, OSCs, escolas, coletivos etc.) aparecem como solicitantes de demandas, beneficiárias de emendas e parceiras de mandatos. A agenda registra reuniões, visitas, plenárias e audiências, e é onde a atuação vira encaminhamento.

## Decisões — Entidades
- **CNPJ opcional e único**, guardado só com dígitos (`CHAR(14)`, `CHECK` no banco) e validado pelo dígito verificador. Coletivos e grupos informais ficam sem CNPJ.
- **Duplicidade.** Antes de salvar, procura nome parecido (`pg_trgm`, similaridade > 0,45) ou CNPJ igual e pede confirmação. CNPJ repetido é bloqueado.
- **Demanda → entidade** (`demanda.entidade_id`, opcional): a pessoa continua sendo o solicitante; a entidade é o coletivo que ela representa.
- **Emenda → entidade beneficiária** (`emenda.entidade_id`, opcional). O texto livre de beneficiário/CNPJ continua; se ficarem em branco, são copiados do cadastro. CNPJ diferente do da entidade é recusado.
- **Entidade ↔ mandato** (`entidade_mandato`) com os tipos de participação de demanda. Autor/coautor são proibidos no Zod e por `CHECK` no banco: autoria só existe em emenda.
- **Contato** (telefone, e-mail) mascarado para o perfil Consulta.
- **Permissões.** Ver: todos. Cadastrar: Admin, Coordenação, Assessor. Editar e vincular mandatos: Admin/Coordenação em todas; Assessor nas que cadastrou. Entidades não são excluídas: ficam inativas e somem das listas de escolha (exceto quando já vinculadas).

## Decisões — Agenda
- **Fuso.** Tudo gravado em UTC (`timestamptz`) e exibido/digitado em `America/Sao_Paulo` (BH não tem horário de verão desde 2019, offset fixo −03:00).
- **Integridade.** `fim > inicio` (`CHECK`), duração máxima de 7 dias (Zod). Cada vínculo aponta para exatamente um alvo (`CHECK num_nonnulls(...) = 1`) e não se repete.
- **Status.** Solicitado, confirmado, realizado, adiado, cancelado. Adiar/cancelar exigem motivo (vai para o histórico). Realizado só depois do início. Resultado/encaminhamentos só depois de realizado.
- **Agenda do vereador** (`agenda_vereador`). Qualquer usuário que cadastra pode solicitar. Confirmar, mudar o horário ou retirar da agenda um compromisso confirmado: só Admin/Coordenação. Se um assessor coloca na agenda do vereador um compromisso já confirmado, ele volta para solicitado.
- **Choque de horário** é aviso, não bloqueio: compromissos solicitados, confirmados ou realizados que se cruzam no tempo (encostar não conta) e têm o mesmo responsável/participante, ou ambos na agenda do vereador.
- **Permissões.** Editar, mudar status e vincular: Admin/Coordenação em todos; Assessor nos que cadastrou ou é responsável. Participantes também registram resultado e comentários.
- **Histórico e auditoria.** `compromisso_historico` (criação, edição, status, vínculo, resultado, comentário) e `audit_log` na mesma transação.

## Fora desta fase
Upload de documentos/atas (módulo Documentos), convites/integração com Google Agenda, participantes externos cadastrados, recorrência.

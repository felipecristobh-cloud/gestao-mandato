# ADR 0003 — Módulo de Demandas (Fase 2)

## Contexto
O gabinete recebe pedidos de cidadãos por vários canais e precisa acompanhar cada um de ponta a ponta: quem pediu, para onde foi encaminhado, quem cuida, qual o prazo e o que aconteceu.

## Decisões
- **Pessoa separada da demanda.** O solicitante é a tabela `pessoa`; uma pessoa pode ter várias demandas. No cadastro, se houver alguém parecido, o usuário escolhe vincular ao cadastro existente ou criar outro.
- **Protocolo `DEM-AAAA-NNNNN`.** Gerado dentro da transação com `INSERT … ON CONFLICT … RETURNING` em `protocolo_seq` (um contador por ano), sem buracos por corrida.
- **Regional vem do bairro.** A demanda guarda só `bairro_id`; a regional é sempre a do bairro, nunca digitada.
- **Duplicidade com `pg_trgm`.** Antes de salvar, o servidor procura pessoas/demandas pelos últimos 8 dígitos do telefone, similaridade do nome, do endereço e da descrição no mesmo bairro. É um alerta, não um bloqueio.
- **Histórico próprio + auditoria.** `demanda_historico` é a linha do tempo legível (cadastro, edição com campos alterados, troca de responsável, status, encaminhamento, retorno, comentário). `audit_log` continua sendo o registro técnico com valores anterior/novo. Os dois são gravados na mesma transação da alteração.
- **Status.** Nova, Em análise, Encaminhada, Aguardando retorno, Em andamento, Resolvida, Não resolvida, Cancelada. Resolvida/Não resolvida/Cancelada preenchem a data de conclusão; reabrir limpa. Cancelar ou marcar não resolvida exige motivo. O primeiro encaminhamento muda Nova/Em análise para Encaminhada.
- **Prazos.** Datas sem hora (`@db.Date`), comparadas com "hoje" no fuso de Belo Horizonte. Filtros: atrasadas, hoje, 7, 15 e 30 dias, sem prazo — só para demandas abertas.
- **Permissões.** Ver: todos os perfis. Cadastrar: Admin, Coordenação, Assessor. Editar, mudar status, encaminhar e comentar: Admin/Coordenação em todas; Assessor só nas que cadastrou ou de que é responsável. Responsável precisa ser usuário ativo que não seja Consulta.
- **LGPD.** A lista não mostra contatos. No detalhe e no alerta de duplicidade, telefone e e-mail aparecem mascarados para quem não tem `contatos:ver_todos` e não é responsável/autor da demanda.

## Fora desta fase
Anexos/documentos (Fase 5), notificações de prazo, painel com gráficos (Fase 6), relatórios/exportação (Fase 7), mapa (Fase 8), cadastro de temas/órgãos/bairros pela interface (por ora vêm do seed).

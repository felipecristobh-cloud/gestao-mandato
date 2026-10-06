# ADR 0004 — Parlamentares e Mandatos (Fase 3)

## Contexto
A atuação do mandato depende de outros mandatos: parceiros que articulam, acompanham ou intermedeiam soluções e, na Fase 4, autores e coautores de emendas. Uma mesma pessoa pode ter vários mandatos ao longo do tempo, inclusive em cargos diferentes.

## Decisões
- **Parlamentar ≠ mandato.** `parlamentar` guarda a pessoa (nome, cargo e partido atuais, esfera, município/UF, contato institucional, observações, ativo). `mandato` guarda cada período (cargo, esfera, legislatura, partido no período, município/UF, início, fim). Partido, município e UF do mandato herdam do parlamentar quando vazios.
- **Esfera vem do cargo.** Vereador → municipal, deputado estadual → estadual, deputado federal/senador → federal. Só o cargo "Outro" aceita esfera escolhida.
- **Sem sobreposição.** O servidor recusa um mandato cujo período cruze outro da mesma pessoa (fim vazio = em aberto). O banco garante `data_fim >= data_inicio`. A situação (vigente, encerrado, futuro) é calculada pela data de hoje em BH, sem campo `ativo` no mandato.
- **Mandato próprio.** `parlamentar.proprio` marca o titular do gabinete; índice único parcial garante no máximo um. Só Admin/Coordenação marcam ou desmarcam.
- **Tipos de participação.** Enum `TipoParticipacao`: autor, coautor, articulador, parceiro, acompanhamento, execução, intermediário. Autoria nunca é inferida: só existe quando alguém cadastra o vínculo AUTOR (Fase 4, em emendas).
- **Demanda ↔ mandato.** `demanda_mandato` liga uma demanda a mandatos parceiros com tipo (articulação, parceria, acompanhamento, execução, intermediação). Autor/coautor e o mandato próprio são recusados aqui — toda demanda já é do mandato próprio. Vincular/remover grava `demanda_historico` (tipo ARTICULACAO) e `audit_log` na mesma transação.
- **Permissões.** Ver: todos. Cadastrar: Admin, Coordenação, Assessor. Editar parlamentar e seus mandatos: Admin/Coordenação em todos; Assessor só nos que cadastrou. Vincular mandato a demanda segue a regra de edição da demanda.
- **Histórico.** A página do parlamentar mostra o `audit_log` do parlamentar e dos seus mandatos.
- **LGPD.** Telefone/e-mail de parlamentar são contatos institucionais de agente público e não são mascarados.

## Fora desta fase
Tabela `emenda_mandato` e rede Mandato → Parceiro → Emenda → Órgão → Beneficiário (Fase 4), importação de dados oficiais de parlamentares.

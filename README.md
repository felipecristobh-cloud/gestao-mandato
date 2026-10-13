# Gestão do Mandato

Sistema de gestão do mandato do vereador Pedro Patrus (CRM parlamentar):
**problema → atuação → articulação → recurso → execução → resultado**.

> Estado: **Fase 8 — Mapa** (sobre as Fases 1 a 7: Fundação, Demandas, Parlamentares e Mandatos, Emendas, Entidades e Agenda, Dashboard, Relatórios).
> Upload de documentos e revisão de segurança vêm nas próximas fases.

## Rodar localmente

Requisitos: Node 22, Docker.

```bash
cp .env.example .env          # ajuste SEED_SENHA
docker compose up -d db       # PostgreSQL 16 em localhost:5432
npm install
npm run db:migrate            # aplica as migrations
npm run db:seed               # 9 regionais + 5 usuários fictícios
npm run dev                   # http://localhost:3000
```

Usuários do seed (senha = `SEED_SENHA`, troca obrigatória no 1º acesso):
`admin@exemplo.local`, `coordenacao@exemplo.local`, `assessor@exemplo.local`, `assessor2@exemplo.local`, `consulta@exemplo.local`.

**Nunca use dados reais de cidadãos em desenvolvimento ou testes.**

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | testes (unitários + integração; recria o banco `gestao_test`) |
| `npm run db:migrate` | cria/aplica migrations em dev |
| `npm run db:deploy` | aplica migrations em homologação/produção |
| `npm run db:seed` | seed de desenvolvimento (bloqueado em produção) |

Os testes de integração usam `DATABASE_URL_TEST` (precisa conter `test` no nome — proteção contra apagar o banco errado).

## Estrutura

```
prisma/               schema, migrations, seed
src/app/(auth)/       login, troca de senha
src/app/(app)/        área autenticada (layout com menu)
src/app/api/health    health check (GET → {status:"ok"})
src/components/       UI, formulários, layout
src/lib/              utilitários puros (máscaras, validação Zod)
src/server/auth/      senha (Argon2), sessão, login, Server Actions
src/server/authz/     matriz de permissões
src/server/audit/     registro de auditoria
src/server/services/  regras de negócio (usadas por actions e testes)
tests/                unit/ e integration/
docs/adr/             decisões de arquitetura
```

## Demandas (Fase 2)

- `/demandas`: lista com busca (protocolo, solicitante, endereço, descrição) e filtros combinados de status, prazo, tema, regional, bairro, responsável e prioridade; contadores de abertas, atrasadas, vencendo em 7 dias, sem responsável e minhas.
- `/demandas/nova`: cadastro rápido com protocolo automático e alerta de duplicidade.
- `/demandas/[id]`: detalhe, mudança de status, encaminhamento a órgão, retorno, comentários e histórico.
- O seed cria temas, órgãos, 27 bairros (3 por regional) e 20 demandas fictícias (só se o banco não tiver nenhuma).
- Decisões em [docs/adr/0003-demandas.md](docs/adr/0003-demandas.md).

## Parlamentares e Mandatos (Fase 3)

- `/parlamentares`: lista com busca (nome, partido, município) e filtros de cargo, esfera e situação; mostra o mandato vigente e quantas demandas estão vinculadas.
- `/parlamentares/[id]`: dados, mandatos (vários por pessoa, sem períodos sobrepostos), demandas articuladas e histórico.
- Na demanda, o card **Mandatos parceiros** registra articulação, parceria, acompanhamento, execução ou intermediação. Autoria não existe em demanda e nunca é atribuída automaticamente ao mandato próprio.
- O seed cria o mandato próprio (Pedro Patrus) e 6 parlamentares parceiros fictícios, com 4 vínculos de exemplo (só se não houver parlamentares).
- Decisões em [docs/adr/0004-parlamentares-mandatos.md](docs/adr/0004-parlamentares-mandatos.md).

## Emendas (Fase 4)

- `/emendas`: lista com busca (código, número, objeto, beneficiário) e filtros de esfera, status, ano, responsável e parlamentar envolvido; totais de indicado, aprovado, empenhado, liquidado, pago e saldo do conjunto filtrado.
- `/emendas/nova` e `/emendas/[id]/editar`: emenda municipal, estadual ou federal com número, ano, tipo, objeto, justificativa, valores indicado/aprovado, beneficiário e CNPJ (com dígito verificador), órgão, secretaria, programa, ação, município, bairro/regional, prazo, responsável interno e observações. Código interno `EME-AAAA-NNNNN`.
- `/emendas/[id]`: valores e execução (lançamentos de empenho, liquidação e pagamento; saldo = empenhado − pago), 13 status com histórico (cancelamento e impedimento técnico exigem motivo), mandatos envolvidos com tipo de participação, responsabilidade e período, referências de documentos e histórico.
- `/emendas/rede`: Rede de Mandatos — mandato próprio → parlamentar parceiro → emenda → órgão → beneficiário, com valores, esfera, status e tipo de participação.
- Autoria só existe quando o vínculo **Autor**/**Coautor** é cadastrado; acompanhar, articular ou executar nunca vira autoria.
- O seed cria 10 emendas fictícias (só se não houver emendas).
- Decisões em [docs/adr/0005-emendas.md](docs/adr/0005-emendas.md).

## Entidades e Agenda (Fase 5)

- `/entidades`: lista com busca (nome, CNPJ, responsável) e filtros de tipo, área, regional, bairro e situação. Cadastro com aviso de duplicidade por nome parecido ou CNPJ igual (CNPJ único, com dígito verificador).
- `/entidades/[id]`: dados, contato (mascarado para Consulta), demandas, emendas, reuniões, mandatos relacionados (parceria, acompanhamento etc. — nunca autoria) e histórico.
- Demanda ganha **entidade relacionada**; emenda ganha **entidade beneficiária** (o texto livre continua; se ficar em branco, nome e CNPJ vêm do cadastro).
- `/agenda`: visões semana, mês e lista, com filtros de texto, tipo, status, pessoa e agenda do vereador. Horários sempre no fuso de BH.
- `/agenda/nova` e `/agenda/[id]`: 8 tipos de compromisso, início/fim, local, bairro, responsável, participantes internos, pauta, status (adiar/cancelar pedem motivo), resultado e encaminhamentos (a "ata", só depois de realizado), vínculos com demandas, emendas, entidades, parlamentares e mandatos, e alerta de choque de horário entre as mesmas pessoas.
- Agenda do vereador: qualquer usuário que cadastra pode **solicitar**; só Coordenação/Admin **confirmam** ou mudam o horário de um compromisso já confirmado.
- O seed cria 9 entidades (as beneficiárias das emendas + 3 sem CNPJ) e 6 compromissos em volta da data atual (só se não houver nenhum).
- Decisões em [docs/adr/0006-entidades-agenda.md](docs/adr/0006-entidades-agenda.md).

## Dashboard (Fase 6)

- `/dashboard`: cards e gráficos (Recharts) de demandas e emendas, mais os pontos de atenção.
  - Filtros: período de entrada das demandas, ano das emendas e "só as minhas".
  - Clicar num gráfico abre a lista já filtrada.
- Tudo é calculado no servidor a cada acesso, então qualquer alteração aparece na hora.
- Definições e decisões em [docs/adr/0007-dashboard.md](docs/adr/0007-dashboard.md).

## Relatórios (Fase 7)

- `/relatorios`: 17 relatórios de demandas e emendas.
  - Mostra os filtros e uma prévia na tela.
  - Baixa em CSV, Excel (com fórmulas) ou PDF, pela rota `/relatorios/exportar`.
- Nome e telefone do solicitante só saem para Admin/Coordenação, quando marcados.
- Toda exportação fica na auditoria.
- Decisões em [docs/adr/0008-relatorios.md](docs/adr/0008-relatorios.md).

## Mapa (Fase 8)

- `/mapa`: demandas no mapa (Leaflet + OpenStreetMap, sem custo e sem chave).
  - Filtros por regional, bairro, tema, status e período.
  - Clicando no ponto, aparece o resumo da demanda.
- No cadastro da demanda, dá pra marcar o ponto clicando no mapa ou com "Localizar endereço" (Nominatim/OSM).
- Demanda sem ponto aparece no centro do bairro.
- O ponto exato segue a regra do telefone: o Consulta vê só o centro do bairro.
- Decisões em [docs/adr/0009-mapa.md](docs/adr/0009-mapa.md).

## Segurança

- Senhas com Argon2id; política mínima de 10 caracteres com letra e número.
- Sessão opaca: o cookie `gm_sessao` (httpOnly, SameSite=Lax, Secure em produção) guarda um token aleatório; o banco guarda só o SHA-256 dele. Expira em 8 h.
- A cada requisição o usuário é revalidado no banco — desativado perde acesso na hora.
- 5 senhas erradas → bloqueio de 15 min. Toda falha fica na auditoria.
- Permissões checadas no servidor em toda página e ação (`exigir`, `exigirPermissaoPagina`).
- Auditoria na mesma transação da alteração, sem hashes ou tokens.
- Headers: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. Site marcado `noindex`.

## Deploy (homologação, custo zero)

1. Criar projeto no **Supabase** (Free) e copiar a connection string *pooled* para `DATABASE_URL` (com `?pgbouncer=true`) e a *direct* para `DIRECT_URL` se necessário.
2. Importar o repositório na **Vercel** (Hobby). Variáveis: `DATABASE_URL`.
3. Build command: `npx prisma migrate deploy && npm run build`.
4. Criar o primeiro Admin com `PERMITIR_SEED=1 SEED_SENHA=... npm run db:seed` apontando para o banco de homologação, e trocar a senha no 1º acesso.

Detalhes e alternativas na entrega da Fase 0 e em `docs/adr/`.

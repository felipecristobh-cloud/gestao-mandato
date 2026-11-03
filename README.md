# Gestão do Mandato

Sistema de gestão do mandato do vereador Pedro Patrus (CRM parlamentar):
**problema → atuação → articulação → recurso → execução → resultado**.

> Estado: **Fase 3 — Parlamentares e Mandatos** (sobre a Fase 1 — Fundação e a Fase 2 — Demandas).
> Emendas, entidades, agenda, dashboard, relatórios e mapa vêm nas próximas fases.

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

# ADR 0002 — Perfis e permissões

| Permissão | Admin | Coordenação | Assessor | Consulta |
|---|:-:|:-:|:-:|:-:|
| Gerenciar usuários | ✔ | | | |
| Ver auditoria | ✔ | ✔ | | |
| Ver dados | ✔ | ✔ | ✔ | ✔ |
| Criar registros | ✔ | ✔ | ✔ | |
| Editar qualquer registro | ✔ | ✔ | | |
| Editar registros próprios (responsável ou criador) | ✔ | ✔ | ✔ | |
| Ver telefone/e-mail de todos os cidadãos | ✔ | ✔ | só nas suas demandas | |
| Exportar relatórios | ✔ | ✔ | ✔ | |
| Exportar com dados pessoais | ✔ | ✔ | | |
| Anonimizar (LGPD) | ✔ | | | |

Fonte da verdade: `src/server/authz/index.ts` (testado em `tests/unit/authz.test.ts`).

Regras extras:
- O sistema nunca fica sem um Admin ativo; o Admin não altera o próprio perfil nem se desativa.
- Desativar ou mudar o perfil de um usuário encerra todas as sessões dele na hora.

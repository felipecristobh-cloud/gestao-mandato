# ADR 0001 — Stack e arquitetura

**Status:** aprovado (Fase 0, outubro/2026)

## Decisão
- Um único app **Next.js (App Router) + TypeScript**, com regras de negócio em `src/server/services` e Server Actions finas.
- **PostgreSQL** via **Prisma** (migrations versionadas em `prisma/migrations`).
- Autenticação própria: e-mail + senha (Argon2id), sessão opaca no banco (cookie httpOnly, 8 h), bloqueio após 5 falhas por 15 min.
- Autorização sempre no servidor (`src/server/authz`), nunca só na interface.
- Auditoria (`audit_log`) gravada na mesma transação da alteração.
- Documentos em storage S3 privado (MinIO local; Supabase Storage/R2 em homologação) — Fase 5.
- Homologação: Vercel Hobby + Supabase Free (custo zero). Produção decidida na Fase 10.

## Por que não evoluir o Gabinete Digital
O app anterior usa SQLite e um modelo diferente; migrar seria mais caro que começar limpo. Dados úteis podem ser importados depois.

## Consequências
- Sem dependência de provedor de identidade externo; reset de senha é feito pelo Admin (sem envio de e-mail na Fase 1).
- Base de cidadãos do mandato fica separada de mapas eleitorais/dados de campanha (LGPD e legislação eleitoral).

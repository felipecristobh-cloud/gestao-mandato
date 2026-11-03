#!/usr/bin/env bash
# Build da Vercel: gera o Prisma Client, aplica as migrations e compila.
# Migrations usam a conexão direta/sessão (DIRECT_URL); o app usa a pooled (DATABASE_URL).
set -euo pipefail
npx prisma generate
DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy
npx next build

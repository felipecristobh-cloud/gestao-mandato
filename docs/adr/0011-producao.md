# ADR 0011 — Produção com custo zero (Fase 10)

## Decisão

| Peça | Escolha | Por quê |
|---|---|---|
| App | Vercel Hobby | Grátis, deploy a cada push, HTTPS. |
| Banco | Supabase Free (Postgres, região São Paulo) | Grátis, Postgres puro (mesmo do dev). |
| Documentos | Bucket privado do Supabase Storage (1 GB) | Mesma conta do banco; R2 exigiria outra conta. A interface `Storage` permite trocar depois. |
| Backup | GitHub Actions diário, cifrado, artifact 30 dias | O plano grátis do Supabase não oferece backup baixável. |
| Monitoramento | GitHub Actions a cada 15 min em `/api/health` | Grátis; falha gera e-mail do GitHub. Logs de erro ficam na Vercel. |

## Consequências

- **Limite de upload na Vercel:** o corpo de uma requisição vai até 4,5 MB, então em produção o limite é 4 MB (`NEXT_PUBLIC_DOCUMENTOS_MAX_MB=4`). Para 10 MB seria preciso upload direto ao bucket, o que tira do servidor a checagem do tipo real e a cifra; preferimos o limite menor.
- **Conexões:** o app usa o pooler de transação (6543, `pgbouncer=true`, `connection_limit=1`); as migrations usam `DIRECT_URL` (pooler de sessão, 5432) no build.
- **Pausa do Supabase Free:** projeto sem uso por 7 dias é pausado. O monitoramento e o backup diário mantêm o banco ativo.
- **Chaves:** `DOCUMENTOS_CHAVE`, `SUPABASE_SERVICE_ROLE_KEY` e `BACKUP_SENHA` ficam só nas variáveis da Vercel/GitHub e num cofre de senhas. Perder `DOCUMENTOS_CHAVE` = perder os anexos.
- O cron do GitHub pode atrasar alguns minutos e é desligado se o repositório ficar 60 dias sem commits.

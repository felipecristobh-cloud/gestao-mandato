# Produção — passo a passo (custo zero)

## 1. Supabase (banco + documentos)

1. Criar projeto em https://supabase.com (plano Free, região **South America (São Paulo)**). Guardar a senha do banco num cofre.
2. **Project Settings → Database → Connection string**:
   - *Transaction pooler* (porta 6543) → `DATABASE_URL`, acrescentando `?pgbouncer=true&connection_limit=1`.
   - *Session pooler* (porta 5432) → `DIRECT_URL` (migrations e backup).
3. **Storage → New bucket** `documentos`, **privado** (Public desligado).
4. **Project Settings → API**: copiar a URL do projeto (`SUPABASE_URL`) e a chave `service_role` (`SUPABASE_SERVICE_ROLE_KEY`). A service_role nunca vai para o navegador.

## 2. Vercel (aplicação)

1. Em https://vercel.com, entrar com o GitHub e importar `gestao-mandato` (Framework: Next.js). O build usa `npm run vercel-build` automaticamente.
2. Variáveis de ambiente (Production):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | pooler de transação (6543) + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | pooler de sessão (5432) |
| `DOCUMENTOS_CHAVE` | `openssl rand -base64 32` (guardar no cofre) |
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
| `NEXT_PUBLIC_DOCUMENTOS_MAX_MB` | `4` |

3. Deploy. Conferir `https://<seu-app>.vercel.app/api/health` → `{"status":"ok"}`.

## 3. Primeiro Admin

No computador (ou no Devin), apontando para o banco de produção:

```bash
DATABASE_URL="<DIRECT_URL>" ADMIN_EMAIL="voce@dominio" ADMIN_NOME="Seu Nome" ADMIN_SENHA="SenhaProvisoria123" npm run criar-admin
```

Entrar, trocar a senha e cadastrar a equipe em **Usuários**. Não rodar o seed (dados fictícios) em produção.

## 4. Backup diário (GitHub Actions)

Em **Settings → Secrets and variables → Actions** do repositório:

- Secrets: `BACKUP_DATABASE_URL` (= `DIRECT_URL`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_SENHA` (senha longa, guardar no cofre).
- Variable: `BACKUP_ATIVO` = `1`.

Roda todo dia às 03:15 (Brasília) e guarda um arquivo cifrado por 30 dias em **Actions → Backup diário → Artifacts**. Rodar na mão: **Run workflow**.

**Restaurar:**

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in backup-AAAAMMDD-HHMM.tar.enc | tar -x
pg_restore --clean --if-exists --no-owner -d "$DIRECT_URL" banco.dump
# documentos/AAAA/MM/<id>: reenviar ao bucket com o mesmo caminho (continuam cifrados com DOCUMENTOS_CHAVE)
```

Testar a restauração num projeto Supabase de teste pelo menos uma vez.

## 5. Monitoramento

- Variable `URL_PRODUCAO` = `https://<seu-app>.vercel.app` ativa o workflow **Monitoramento** (a cada 15 min). Se o sistema ou o banco cair, o GitHub manda e-mail de falha.
- Erros da aplicação: **Vercel → Project → Logs**.
- Uso do banco/storage: painel do Supabase (limites Free: 500 MB de banco, 1 GB de arquivos).

## 6. Rotina e segurança

- Senhas e chaves só no cofre e nas variáveis da Vercel/GitHub; nunca no código.
- Ao desligar alguém da equipe: desativar o usuário (perde o acesso na hora).
- Trocar `DOCUMENTOS_CHAVE` invalida os anexos existentes: não trocar sem plano de recifragem.
- Revisar a auditoria (**Configurações → Auditoria**) e os alertas do `npm audit` a cada atualização.

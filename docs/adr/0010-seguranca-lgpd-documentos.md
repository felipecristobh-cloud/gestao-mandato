# ADR 0010 — Segurança, LGPD e documentos (Fase 9)

## Documentos
- Anexos ligados a no máximo um registro (demanda, emenda ou entidade; constraint `documento_um_vinculo`) ou avulsos.
- Aceitos: PDF, PNG, JPG, WEBP, DOCX, XLSX, ODT, ODS, DOC, XLS, até 10 MB. A assinatura (magic bytes) precisa bater com a extensão; o nome é limpo (sem pastas nem caracteres de controle).
- Armazenamento: interface `Storage` (`src/server/storage`). Hoje em disco (`DOCUMENTOS_DIR`, padrão `.dados/documentos`, fora de `public/`), cifrado com AES-256-GCM (IV aleatório, chave lógica como AAD). Em produção `DOCUMENTOS_CHAVE` (32 bytes, base64 ou hex) é obrigatória. Storage S3 (Supabase/R2) fica para a Fase 10, implementando a mesma interface.
- Download só por `/documentos/[id]/arquivo`, com sessão válida, `Content-Disposition: attachment`, `no-store` e CSP `sandbox`.
- Acesso: precisa de `dados:ver`; restrito só com `documentos_restritos:ver` (Admin/Coordenação), e para os demais o documento nem aparece. Anexo de demanda segue a regra do contato do solicitante (Admin, Coordenação, responsável ou quem cadastrou); para os outros aparece só como "Anexo da demanda", sem nome. Envio exige poder editar o registro de destino; remoção, `dados:editar_todos` ou ter enviado.
- Auditoria: CRIAR, DOWNLOAD e EXCLUIR.

## Login
- Além do bloqueio por conta (5 falhas → 15 min), bloqueio por IP: 20 falhas em 15 min (contadas na auditoria).
- A sessão nasce numa transação que relê `ativo` com `FOR UPDATE`; desativar a conta durante a checagem da senha impede o login.

## LGPD
- Auditoria guarda telefone e e-mail mascarados (`sanitizar`).
- Admin (`lgpd:anonimizar`) pode anonimizar um solicitante, com motivo e confirmação: nome vira "Titular anonimizado", contato/endereço/ponto exato são apagados em todas as demandas dele, os anexos dessas demandas são removidos e esses campos são trocados por `[anonimizado]` nos registros de auditoria ligados. As demandas continuam (protocolo, tema, bairro, status) nos indicadores. Texto livre (descrição, comentários) não é limpo automaticamente — o formulário avisa.

## Navegador
- CSP com nonce por requisição (`src/middleware.ts`), `strict-dynamic`, sem `unsafe-eval` em produção, `frame-ancestors 'none'`, `object-src 'none'`, imagens só do próprio site e de `tile.openstreetmap.org`. Por isso todas as páginas são dinâmicas.
- Mantidos: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.

## Backup
- `npm run backup` (`scripts/backup.sh`): `pg_dump` custom + tar dos documentos (ainda cifrados), retenção de 30 dias. A chave `DOCUMENTOS_CHAVE` fica fora do backup.

## Pendências conhecidas
- `npm audit`: restam alertas transitivos (deepmerge-ts via Prisma, uuid via ExcelJS) e zod 3; a correção exige upgrades major (Prisma 7, Zod 4) — avaliar na Fase 10.

#!/usr/bin/env bash
# Backup da produção (Supabase): banco (pg_dump) + documentos do bucket, num único arquivo cifrado.
# Uso: DATABASE_URL=<conexão direta> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BACKUP_SENHA=... ./scripts/backup-nuvem.sh [pasta]
# Restaurar: openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in backup-*.tar.enc | tar -x
#            pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" banco.dump   (documentos/: reenviar ao bucket)
# Os documentos continuam cifrados com DOCUMENTOS_CHAVE, que fica fora do backup (cofre de senhas).
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL}" "${BACKUP_SENHA:?Defina BACKUP_SENHA}"
DESTINO="${1:-./backups}"
BUCKET="${DOCUMENTOS_BUCKET:-documentos}"
CARIMBO="$(date -u +%Y%m%d-%H%M)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DESTINO" "$TMP/documentos"
URL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --no-privileges --schema=public --dbname="$URL" --file="$TMP/banco.dump"
N=0
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  while IFS= read -r chave; do
    [ -z "$chave" ] && continue
    mkdir -p "$TMP/documentos/$(dirname "$chave")"
    curl -fsS -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      "${SUPABASE_URL%/}/storage/v1/object/$BUCKET/$chave" -o "$TMP/documentos/$chave"
    N=$((N + 1))
  done < <(psql "$URL" -At -c 'SELECT caminho FROM documento ORDER BY caminho')
fi
tar -C "$TMP" -cf - banco.dump documentos | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_SENHA -out "$DESTINO/backup-$CARIMBO.tar.enc"
chmod 600 "$DESTINO/backup-$CARIMBO.tar.enc"
echo "Backup cifrado: $DESTINO/backup-$CARIMBO.tar.enc ($N documentos)"

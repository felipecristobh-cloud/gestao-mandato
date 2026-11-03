#!/usr/bin/env bash
# Backup do banco (pg_dump, formato custom) e dos documentos criptografados.
# Uso: DATABASE_URL=... ./scripts/backup.sh [pasta_destino]   (padrão: ./backups; mantém os últimos 30 dias)
# Restaurar: pg_restore --clean --if-exists -d "$DATABASE_URL" backups/banco-AAAAMMDD-HHMM.dump
#            tar -xzf backups/documentos-AAAAMMDD-HHMM.tar.gz -C "${DOCUMENTOS_DIR:-.dados/documentos}"
# Os documentos só abrem com a mesma DOCUMENTOS_CHAVE: guarde a chave fora do backup (cofre de senhas).
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL}"
DESTINO="${1:-./backups}"
DOCS="${DOCUMENTOS_DIR:-.dados/documentos}"
CARIMBO="$(date +%Y%m%d-%H%M)"
mkdir -p "$DESTINO"
chmod 700 "$DESTINO"
URL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --dbname="$URL" --file="$DESTINO/banco-$CARIMBO.dump"
if [ -d "$DOCS" ]; then tar -czf "$DESTINO/documentos-$CARIMBO.tar.gz" -C "$DOCS" .; fi
chmod 600 "$DESTINO"/*-"$CARIMBO".* 2>/dev/null || true
find "$DESTINO" -maxdepth 1 -type f \( -name 'banco-*.dump' -o -name 'documentos-*.tar.gz' \) -mtime +30 -delete
echo "Backup salvo em $DESTINO (banco-$CARIMBO.dump)"

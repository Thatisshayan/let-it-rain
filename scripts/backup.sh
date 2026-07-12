#!/usr/bin/env bash
# Automated nightly backup script for Let It Rain PostgreSQL database.
# Usage: ./scripts/backup.sh
#
# Run this via a cron job or Vercel Cron Jobs:
#   https://vercel.com/docs/cron-jobs
#
# Environment variables required:
#   DATABASE_URL       — PostgreSQL connection string
#   BACKUP_BUCKET_URL  — S3-compatible storage URL for backup uploads (optional)
#   BACKUP_RETENTION   — Number of days to keep backups (default: 30)
#
# Example cron: 0 3 * * * /path/to/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./.backups}"
RETENTION_DAYS="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="letitrain_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "=== Nightly Backup: $(date) ==="
echo "Database: $DATABASE_URL"

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup written: ${BACKUP_DIR}/${FILENAME}"

SIZE=$(stat -f%z "${BACKUP_DIR}/${FILENAME}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${FILENAME}" 2>/dev/null || echo "0")
echo "Size: $(numfmt --to=iec $SIZE 2>/dev/null || echo $SIZE bytes)"

if [ -n "${BACKUP_BUCKET_URL:-}" ]; then
  echo "Uploading to backup bucket..."
  if curl -X PUT \
    -H "Content-Type: application/gzip" \
    --data-binary "@${BACKUP_DIR}/${FILENAME}" \
    "${BACKUP_BUCKET_URL}/${FILENAME}"; then
    echo "Upload complete."
  else
    echo "ERROR: Upload failed. Backup file remains at ${BACKUP_DIR}/${FILENAME}." >&2
    exit 1
  fi
fi

echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "letitrain_db_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "=== Backup complete ==="

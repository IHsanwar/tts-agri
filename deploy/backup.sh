#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/tts_${TIMESTAMP}.sql.gz"

echo "Starting MySQL database backup..."
mkdir -p "${BACKUP_DIR}"

# Backup using mysqldump with gzip compression
mysqldump \
  -h "${TTS_DB_HOST:-localhost}" \
  -P "${TTS_DB_PORT:-3306}" \
  -u "${TTS_DB_USER:-root}" \
  "-p${TTS_DB_PASSWORD}" \
  --single-transaction \
  --quick \
  "${TTS_DB_NAME:-ttsdulu}" | gzip > "${BACKUP_FILE}"

echo "Rotating backups older than 14 days..."
find "${BACKUP_DIR}" -name "tts_*.sql.gz" -type f -mtime +14 -delete

echo "Backup complete: ${BACKUP_FILE}"


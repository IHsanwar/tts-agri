#!/bin/sh
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/tts_${TIMESTAMP}.sqlite"

echo "Starting SQLite online backup..."
sqlite3 /data/tts.sqlite ".backup '${BACKUP_FILE}'"

echo "Verifying backup integrity..."
sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;"

echo "Rotating backups older than 14 days..."
find "${BACKUP_DIR}" -name "tts_*.sqlite" -type f -mtime +14 -delete

echo "Backup complete: ${BACKUP_FILE}"

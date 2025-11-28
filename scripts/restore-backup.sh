#!/usr/bin/env bash
set -euo pipefail

# Determine repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_NAME="${MONGO_CONTAINER_NAME:-mongodb}"
DB_NAME="${MONGO_DB_NAME:-goldhallmark}"
BACKUP_DIR="${REPO_ROOT}/backups"

if ! command -v docker >/dev/null 2>&1; then
  echo "[restore] docker command not found" >&2
  exit 1
fi

# Find the latest backup file
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/${DB_NAME}-*.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "[restore] No backup file found in $BACKUP_DIR" >&2
  exit 1
fi

echo "[restore] Found backup: $LATEST_BACKUP"
echo "[restore] This will DELETE all existing data and restore from backup!"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] Cancelled."
  exit 0
fi

BACKUP_FILENAME=$(basename "$LATEST_BACKUP")
CONTAINER_BACKUP_PATH="/backups/${BACKUP_FILENAME}"

echo "[restore] Restoring '${DB_NAME}' from ${BACKUP_FILENAME}..."
docker exec "$CONTAINER_NAME" mongorestore \
  --db "$DB_NAME" \
  --archive="$CONTAINER_BACKUP_PATH" \
  --gzip \
  --drop

echo "[restore] ✅ Database restored successfully!"
echo "[restore] Restored from: $LATEST_BACKUP"

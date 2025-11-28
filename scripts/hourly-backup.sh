#!/usr/bin/env bash
set -euo pipefail

# Determine repo root so the script works from any location
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_NAME="${MONGO_CONTAINER_NAME:-mongodb}"
DB_NAME="${MONGO_DB_NAME:-goldhallmark}"
ARCHIVE_NAME="${DB_NAME}-$(date +%Y%m%d-%H%M).gz"
CONTAINER_ARCHIVE_PATH="/backups/${ARCHIVE_NAME}"
LOCAL_CONTAINER_BACKUP_DIR="${REPO_ROOT}/backups"
DEFAULT_BACKUP_DIR="${REPO_ROOT}/backups"
BACKUP_TARGET_DIR="${GOOGLE_DRIVE_BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"

mkdir -p "$LOCAL_CONTAINER_BACKUP_DIR"
mkdir -p "$BACKUP_TARGET_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[backup] docker command not found" >&2
  exit 1
fi

echo "[backup] dumping '${DB_NAME}' from container '${CONTAINER_NAME}'"
docker exec "$CONTAINER_NAME" mongodump \
  --db "$DB_NAME" \
  --archive="$CONTAINER_ARCHIVE_PATH" \
  --gzip

LOCAL_ARCHIVE_PATH="${LOCAL_CONTAINER_BACKUP_DIR}/${ARCHIVE_NAME}"
if [ ! -f "$LOCAL_ARCHIVE_PATH" ]; then
  echo "[backup] expected archive not found at $LOCAL_ARCHIVE_PATH" >&2
  exit 1
fi

# Keep only the latest backup - delete all old ones
echo "[backup] cleaning up old backups..."
find "$BACKUP_TARGET_DIR" -name "${DB_NAME}-*.gz" -type f ! -name "${ARCHIVE_NAME}" -print -delete || true

echo "[backup] archive available at ${LOCAL_ARCHIVE_PATH}"

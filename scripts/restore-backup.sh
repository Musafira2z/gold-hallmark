#!/usr/bin/env bash
# Restore the database from a backup (Mac/Linux shortcut).
# On Windows run the same thing in PowerShell from the gold-hallmark folder:
#     docker compose run --rm backup restore
#
#   ./scripts/restore-backup.sh                 newest good backup
#   ./scripts/restore-backup.sh <file name>     a specific backup (see: list)
#   ./scripts/restore-backup.sh list            show backups
# It asks before changing anything and saves the current data first.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" = "list" ]; then
  exec docker compose run --rm backup list
fi
exec docker compose run --rm backup restore "${1:-}"

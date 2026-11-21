#!/usr/bin/env bash
# Backup / restore for the Gold Hallmark database.
# Runs INSIDE the `backup` container (mongo:7 image), so it works the same on
# Windows and Mac. See backups/README.md for how to use it.
#
#   loop              keep running; back up whenever the newest good backup is
#                     older than BACKUP_EVERY_MINUTES (default service command)
#   now               take one backup right away
#   list              show the backups
#   restore [FILE]    restore FILE (default: newest good backup); asks first and
#                     takes a safety backup of the current data before restoring
set -uo pipefail

MONGO_URI="${MONGO_URI:-mongodb://mongo:27017}"
DB_NAME="${DB_NAME:-goldhallmark}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP="${KEEP:-14}"                         # newest good backups to keep
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"            # one copy per week, this many weeks
BACKUP_EVERY_MINUTES="${BACKUP_EVERY_MINUTES:-360}"
CHECK_EVERY_SECONDS="${CHECK_EVERY_SECONDS:-300}"
MIN_DROP_PERCENT="${MIN_DROP_PERCENT:-50}" # warn if orders fall below this % of last backup

WEEKLY_DIR="$BACKUP_DIR/weekly"
PHOTOS_SRC="${PHOTOS_SRC:-/uploads}"       # the app's photo folder (read-only)
PHOTOS_DIR="$BACKUP_DIR/photos"
LOG="$BACKUP_DIR/backup-log.txt"
LAST_COUNT_FILE="$BACKUP_DIR/.last-order-count"
# Good backups: goldhallmark-YYYYMMDD-HHMM.gz (same name style as the old script)
GOOD_GLOB="${DB_NAME}-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9].gz"

log() {
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S') $*"
  echo "$line"
  echo "$line" >>"$LOG" 2>/dev/null || true
}

count() { # count <collection>
  mongosh "$MONGO_URI/$DB_NAME" --quiet --eval "db.getCollection('$1').countDocuments()" 2>/dev/null | tail -1
}

wait_for_mongo() {
  local i
  for i in $(seq 1 60); do
    mongosh "$MONGO_URI" --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && return 0
    sleep 5
  done
  log "ERROR: database er sathe jog hocche na ($MONGO_URI)"
  return 1
}

newest_good() {
  ls -1t "$BACKUP_DIR"/$GOOD_GLOB 2>/dev/null | head -1
}

# Really check an archive: restore its orders into a scratch database, count
# them, then drop the scratch database. Prints the order count found.
VERIFY_DB="${DB_NAME}_backupcheck"
check_archive() { # check_archive <file> [expected-orders]
  local f="$1" expected="${2:-}" got
  [ -s "$f" ] || { echo "file faka"; return 1; }
  gzip -t "$f" 2>/dev/null || { echo "gzip bhanga"; return 1; }
  mongosh "$MONGO_URI/$VERIFY_DB" --quiet --eval 'db.dropDatabase()' >/dev/null 2>&1
  if ! mongorestore --uri="$MONGO_URI" --archive="$f" --gzip --quiet --drop \
       --nsInclude="$DB_NAME.orders" --nsFrom="$DB_NAME.*" --nsTo="$VERIFY_DB.*" 2>/dev/null; then
    mongosh "$MONGO_URI/$VERIFY_DB" --quiet --eval 'db.dropDatabase()' >/dev/null 2>&1
    echo "mongorestore khulte parche na"; return 1
  fi
  got="$(mongosh "$MONGO_URI/$VERIFY_DB" --quiet --eval 'db.orders.countDocuments()' 2>/dev/null | tail -1)"
  mongosh "$MONGO_URI/$VERIFY_DB" --quiet --eval 'db.dropDatabase()' >/dev/null 2>&1
  case "$got" in ''|*[!0-9]*) echo "order gona gelo na"; return 1 ;; esac
  # New orders can arrive during the dump, so the file may hold a few more.
  if [ -n "$expected" ] && [ "$got" -lt "$expected" ]; then
    echo "file e order $got, database e chilo $expected"; return 1
  fi
  echo "$got"
}

# take_backup <name-suffix>   suffix "" = normal rotating backup
take_backup() {
  local suffix="${1:-}" stamp name tmp final orders customers why last
  stamp="$(date +%Y%m%d-%H%M)"
  name="${DB_NAME}-${stamp}${suffix}.gz"
  tmp="$BACKUP_DIR/.tmp-$name"
  final="$BACKUP_DIR/$name"

  wait_for_mongo || return 1
  orders="$(count orders)"; customers="$(count users)"

  if ! mongodump --uri="$MONGO_URI" --db="$DB_NAME" --archive="$tmp" --gzip --quiet; then
    log "ERROR: mongodump fail korche, purono backup gula rakha holo"
    rm -f "$tmp"; return 1
  fi

  if ! why="$(check_archive "$tmp" "${orders:-0}")"; then
    mv "$tmp" "$BACKUP_DIR/${DB_NAME}-${stamp}${suffix}.BAD.gz"
    log "ERROR: backup kharap ($why). ${DB_NAME}-${stamp}${suffix}.BAD.gz hishebe rakha holo, purono gula muchha hoy nai"
    return 1
  fi

  # Orders suddenly gone or far fewer than last time: keep it, but do not let it
  # push good old backups out of the rotation.
  last="$(cat "$LAST_COUNT_FILE" 2>/dev/null || echo 0)"
  if [ -z "$suffix" ] && [ "${last:-0}" -gt 0 ] \
     && [ "$(( ${orders:-0} * 100 ))" -lt "$(( last * MIN_DROP_PERCENT ))" ]; then
    mv "$tmp" "$BACKUP_DIR/${DB_NAME}-${stamp}.CHECK.gz"
    log "WARNING: order ${last} theke ${orders} e neme geche. ${DB_NAME}-${stamp}.CHECK.gz hishebe rakha holo, purono gula muchha hoy nai"
    # cap the .CHECK pile at KEEP files (good backups are still never touched)
    ls -1t "$BACKUP_DIR"/${DB_NAME}-*.CHECK.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
    return 1
  fi

  mv "$tmp" "$final"
  log "OK: $name ($(du -h "$final" | cut -f1), customer $customers, order $orders)"
  copy_photos

  if [ -z "$suffix" ]; then
    echo "${orders:-0}" >"$LAST_COUNT_FILE"
    weekly_copy "$final"
    prune
  fi
  return 0
}

# Photos never change, so copy only the new ones and never delete any.
copy_photos() {
  [ -d "$PHOTOS_SRC" ] || return 0
  mkdir -p "$PHOTOS_DIR"
  local f n=0 missing=0
  for f in "$PHOTOS_SRC"/*; do
    [ -f "$f" ] || continue
    [ -e "$PHOTOS_DIR/${f##*/}" ] && continue
    if cp -p "$f" "$PHOTOS_DIR/${f##*/}"; then n=$((n + 1)); else missing=$((missing + 1)); fi
  done
  [ "$n" -gt 0 ] && log "OK: photo $n ta notun copy holo (photos/ e mot $(ls -1 "$PHOTOS_DIR" | wc -l))"
  [ "$missing" -gt 0 ] && log "WARNING: $missing ta photo copy kora gelo na"
  return 0
}

# First good backup of each week also goes to weekly/.
weekly_copy() {
  local f="$1" week
  week="$(date +%G-W%V)"
  mkdir -p "$WEEKLY_DIR"
  if ! ls "$WEEKLY_DIR"/${DB_NAME}-week-"$week"-*.gz >/dev/null 2>&1; then
    cp "$f" "$WEEKLY_DIR/${DB_NAME}-week-$week-$(basename "$f" | sed "s/^${DB_NAME}-//")"
    log "OK: weekly copy rakha holo ($week)"
  fi
  ls -1t "$WEEKLY_DIR"/${DB_NAME}-week-*.gz 2>/dev/null | tail -n +"$((KEEP_WEEKLY + 1))" | while read -r old; do
    rm -f "$old"; log "muchha holo (purono weekly): $(basename "$old")"
  done
}

# Only called right after a good backup. Never touches .BAD/.CHECK/before-restore files.
prune() {
  ls -1t "$BACKUP_DIR"/$GOOD_GLOB 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"; log "muchha holo (purono): $(basename "$old")"
  done
}

# Since the last attempt of any kind (good, .CHECK or .BAD), so a failing
# backup is retried at the normal interval instead of every few minutes.
minutes_since_newest() {
  local f; f="$(ls -1t "$BACKUP_DIR"/$GOOD_GLOB "$BACKUP_DIR"/${DB_NAME}-*.CHECK.gz "$BACKUP_DIR"/${DB_NAME}-*.BAD.gz 2>/dev/null | head -1)"
  [ -n "$f" ] || { echo 999999; return; }
  echo $(( ( $(date +%s) - $(stat -c %Y "$f") ) / 60 ))
}

cmd_loop() {
  mkdir -p "$BACKUP_DIR"
  rm -f "$BACKUP_DIR"/.tmp-* 2>/dev/null
  log "backup service chalu: proti ${BACKUP_EVERY_MINUTES} minute e backup, shesh $KEEP ta + $KEEP_WEEKLY ta weekly rakhbe"
  while true; do
    if [ "$(minutes_since_newest)" -ge "$BACKUP_EVERY_MINUTES" ]; then
      take_backup ""
    fi
    sleep "$CHECK_EVERY_SECONDS"
  done
}

cmd_list() {
  echo "Backup folder: $BACKUP_DIR"
  ls -lh "$BACKUP_DIR"/${DB_NAME}-*.gz 2>/dev/null | awk '{print $5"\t"$6" "$7" "$8"\t"$9}' | sed "s#$BACKUP_DIR/##"
  echo "--- weekly ---"
  ls -lh "$WEEKLY_DIR"/*.gz 2>/dev/null | awk '{print $5"\t"$9}' | sed "s#$WEEKLY_DIR/##"
}

cmd_restore() {
  local file="${1:-}" why ans
  if [ -z "$file" ]; then
    file="$(newest_good)"
  elif [ ! -f "$file" ]; then
    if [ -f "$BACKUP_DIR/$file" ]; then file="$BACKUP_DIR/$file"
    elif [ -f "$WEEKLY_DIR/$file" ]; then file="$WEEKLY_DIR/$file"
    else echo "File pawa jay ni: $file"; cmd_list; return 1; fi
  fi
  [ -n "$file" ] || { echo "Kono backup nai."; return 1; }

  wait_for_mongo || return 1
  echo "Backup ta check kora hocche..."
  if ! why="$(check_archive "$file")"; then
    echo "Ei backup ta kharap ($why). Restore kora holo na."; return 1
  fi

  echo
  echo "Ekhon database e: customer $(count users), order $(count orders)"
  echo "Restore korbo:    $(basename "$file") (order $why)"
  echo
  echo "Ekhonkar sob data muche ei backup er data boshbe."
  echo "(Tar age ekhonkar data r ekta safety copy rakha hobe.)"
  printf "Nishchit? 'yes' likhe Enter din: "
  read -r ans
  [ "$ans" = "yes" ] || { echo "Bad dewa holo, kichu bodlay nai."; return 0; }

  echo "Safety copy nichhi..."
  if ! take_backup "-before-restore"; then
    echo "Safety copy neya gelo na, tai restore kora holo na."; return 1
  fi

  echo "Restore hocche..."
  if mongorestore --uri="$MONGO_URI" --archive="$file" --gzip --drop \
       --nsInclude="$DB_NAME.*" --quiet; then
    log "RESTORE: $(basename "$file") theke restore holo. Ekhon customer $(count users), order $(count orders)"
    echo "Hoye geche. Ekhon customer $(count users), order $(count orders)."
  else
    log "ERROR: restore fail korche ($(basename "$file"))"
    echo "Restore fail korche. Safety copy ta ${BACKUP_DIR} e ache (-before-restore)."
    return 1
  fi
}

mkdir -p "$BACKUP_DIR"
case "${1:-loop}" in
  loop)    cmd_loop ;;
  now)     take_backup "" ;;
  list)    cmd_list ;;
  restore) shift; cmd_restore "${1:-}" ;;
  *) echo "Use: loop | now | list | restore [file]"; exit 2 ;;
esac

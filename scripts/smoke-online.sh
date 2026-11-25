#!/bin/bash
# Checks a live online site (Plan 23). Reads only; changes nothing.
#   scripts/smoke-online.sh https://sylhethallmark.com
# Optional:
#   SMOKE_CACERT=<file>   trust this certificate authority too (the rehearsal's own HTTPS)
#   SMOKE_RESOLVE=host:443:ip   send the name to this address (before DNS is switched)
#   SMOKE_NO_DESKTOP=1    skip the /desktop/ checks (no update published yet)
#   SMOKE_MIN_CERT_DAYS   default 14 (the rehearsal's certificates last hours, so it uses 0)
set -uo pipefail
BASE="${1:?Give the site address, e.g. https://sylhethallmark.com}"
BASE="${BASE%/}"
HOST="${BASE#*://}"; HOST="${HOST%%/*}"
C=(curl -sS --max-time 30)
[ -n "${SMOKE_CACERT:-}" ] && C+=(--cacert "$SMOKE_CACERT")
[ -n "${SMOKE_RESOLVE:-}" ] && C+=(--resolve "$SMOKE_RESOLVE" --resolve "${SMOKE_RESOLVE/:443:/:80:}")
PASS=0; FAIL=0
ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: got '$2', want '$3'"; fi; }
code() { "${C[@]}" -o /dev/null -w '%{http_code}' "$@"; }
header() { "${C[@]}" -o /dev/null -D - "$2" | tr -d '\r' | grep -i "^$1:" | head -1 | cut -d' ' -f2-; }

echo "== $BASE =="
H=$("${C[@]}" "$BASE/api/health")
echo "$H" | grep -q '"ok":true' && ok "health: $H" || bad "health: $H"

if [[ "$BASE" == https://* ]]; then
    "${C[@]}" -o /dev/null "$BASE/robots.txt" && ok "HTTPS certificate is trusted" || bad "HTTPS certificate"
    CONNECT="$HOST:443"; [ -n "${SMOKE_RESOLVE:-}" ] && CONNECT="${SMOKE_RESOLVE##*:}:443"
    DAYS=$(echo | openssl s_client -servername "$HOST" -connect "$CONNECT" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$DAYS" ]; then
        LEFT=$(( ($(date -d "$DAYS" +%s) - $(date +%s)) / 86400 ))
        [ "$LEFT" -ge "${SMOKE_MIN_CERT_DAYS:-14}" ] && ok "certificate valid for $LEFT more days" || bad "certificate ends in $LEFT days"
    fi
    LOC=$("${C[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' "http://$HOST/report")
    check "http goes to https" "$LOC" "301 https://$HOST/report"
    case "$(header strict-transport-security "$BASE/report")" in *max-age=*) ok "HSTS header";; *) bad "no HSTS header";; esac
fi

for h in x-content-type-options x-frame-options content-security-policy referrer-policy; do
    [ -n "$(header $h "$BASE/report")" ] && ok "header $h" || bad "header $h missing"
done
check "no x-powered-by" "$(header x-powered-by "$BASE/report")" ""
check "report search page" "$(code "$BASE/report")" 200
check "unknown QR link: not found" "$(code "$BASE/r/AAAAAAAAAAAA")" 404
check "wrong memo + code: not found" "$(code "$BASE/report?memo=1&code=ZZZZ")" 404
check "karigor login page" "$(code "$BASE/login")" 200
check "owner app login page" "$(code "$BASE/owner/login")" 200
"${C[@]}" "$BASE/robots.txt" | grep -q '^Disallow: /r/' && ok "robots keeps reports out of search" || bad "robots"
check "sync with a wrong key: refused" "$(code -X POST -H 'Authorization: Bearer wrong-key-wrong-key-wrong' -H 'Content-Type: application/json' -d '{"orders":[]}' "$BASE/api/sync/orders")" 401

if [ -z "${SMOKE_NO_DESKTOP:-}" ]; then
    Y=$("${C[@]}" "$BASE/desktop/latest.yml")
    V=$(echo "$Y" | sed -n 's/^version: *//p')
    F=$(echo "$Y" | sed -n 's/^path: *//p')
    [ -n "$V" ] && [ -n "$F" ] && ok "update offered: $V ($F)" || bad "/desktop/latest.yml"
    if [ -n "$F" ]; then
        check "  installer is there" "$(code -I "$BASE/desktop/$F")" 200
        check "  its signature is there" "$(code "$BASE/desktop/$F.sig")" 200
    fi
    check "  other files hidden" "$(code "$BASE/desktop/.update-signing-key.pem")" 404
fi

echo "TOTAL: $PASS pass, $FAIL fail"
[ "$FAIL" -eq 0 ]

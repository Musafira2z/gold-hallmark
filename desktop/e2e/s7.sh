#!/bin/bash
# S7 rehearsal (Plan 23), run by s7.compose.yml. The whole chain before the real website exists:
# the desktop app with the test copy syncs over HTTPS, reports open by their QR link,
# an update is published with scripts/publish-desktop.sh and the app accepts it,
# and scripts/smoke-online.sh passes against the site.
set -uo pipefail
cd /repo/desktop
CDP=/repo/desktop/e2e/cdp.js
SITE=https://sylhethallmark.com
export GOLD_DATA_DIR=/gold HOME=/root
mkdir -p mongo && for t in mongod mongodump mongorestore; do cp "$(command -v $t)" mongo/; done
trap "rm -rf /repo/desktop/mongo /tmp/oldapp /tmp/srcdb /gold" EXIT
PASS=0; FAIL=0
ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: got '$2', want '$3'"; fi; }
APP=""
launch() { xvfb-run -a npx electron --no-sandbox --remote-debugging-port=9333 . "$@" >>/tmp/electron.out 2>&1 & APP=$!; }
ready() { for i in $(seq 1 180); do [ "$(grep -c "Ready." /gold/logs/app.log 2>/dev/null)" -ge "$1" ] && return 0; sleep 1; done; return 1; }
gone() { for i in $(seq 1 90); do pgrep -f "dist/electron --no-sandbox --remote" >/dev/null || return 0; sleep 1; done; return 1; }
quit() { node $CDP closeall >/dev/null 2>&1; gone; }
waitlog() { for i in $(seq 1 ${3:-120}); do [ "$(grep -c "$1" "${2:-/gold/logs/app.log}" 2>/dev/null)" -ge 1 ] && return 0; sleep 1; done; return 1; }
q() { mongosh --quiet "$1" --eval "$2" | tail -1; }
SHOP=mongodb://127.0.0.1:47117/goldhallmark
ONLINE=mongodb://atlas:27017/goldhallmark_online

echo "== trust the rehearsal's HTTPS (like a real certificate) =="
CA=/caddy/caddy/pki/authorities/local/root.crt
for i in $(seq 1 60); do [ -f $CA ] && curl -s -o /dev/null --cacert $CA $SITE/robots.txt && break; sleep 1; done
cp $CA /usr/local/share/ca-certificates/s7-rehearsal.crt && update-ca-certificates >/dev/null 2>&1
export NODE_EXTRA_CA_CERTS=$CA # the shop server's sync (Node)
mkdir -p /root/.pki/nssdb && certutil -d sql:/root/.pki/nssdb -N --empty-password 2>/dev/null
certutil -d sql:/root/.pki/nssdb -A -n s7-rehearsal -t "C,," -i $CA # the app's update check (Chromium)
curl -s -o /dev/null $SITE/robots.txt && ok "HTTPS works" || bad "HTTPS"

echo "== the empty site =="
SMOKE_NO_DESKTOP=1 SMOKE_MIN_CERT_DAYS=0 bash /repo/scripts/smoke-online.sh $SITE > /tmp/smoke1.txt
cat /tmp/smoke1.txt
check "smoke test on the empty site" "$(tail -1 /tmp/smoke1.txt | grep -o '[0-9]* fail')" "0 fail"

echo "== old app's backup (the test copy) =="
mkdir -p /tmp/srcdb /tmp/oldapp
mongod --dbpath /tmp/srcdb --port 27999 --bind_ip 127.0.0.1 --logpath /tmp/srcdb.log --fork >/dev/null
mongorestore --uri=mongodb://127.0.0.1:27999 --archive=/src/dev.gz --gzip --quiet --nsFrom='goldhallmark_dev.*' --nsTo='goldhallmark.*'
mongodump --uri=mongodb://127.0.0.1:27999 --db=goldhallmark --archive=/tmp/oldapp/goldhallmark-20261126-0900.gz --gzip --quiet
cp -r /src/photos /tmp/oldapp/photos
mongosh --quiet mongodb://127.0.0.1:27999/admin --eval 'db.shutdownServer()' >/dev/null 2>&1

echo "== the shop app, with sync on, brings the data over and syncs it =="
rm -rf /gold && mkdir -p /gold
node -e 'require("fs").writeFileSync("/gold/settings.json", JSON.stringify({ syncUrl: "https://sylhethallmark.com", syncKey: process.env.SYNC_KEY }, null, 2))'
export SYNC_EVERY_SECONDS=10
launch --import /tmp/oldapp/goldhallmark-20261126-0900.gz
ready 1 && ok "app started" || bad "start"
for i in $(seq 1 300); do ls /gold/logs/import-*.txt >/dev/null 2>&1 && break; sleep 1; done
grep -q "RESULT: everything brought over" /gold/logs/import-*.txt && ok "test copy brought over" || bad "import"
waitlog "Sync is on: every 10 s to https://sylhethallmark.com" /gold/logs/server.log 60 && ok "sync on, to the https address" || bad "sync not on"
WANT=$(q $SHOP 'db.orders.countDocuments({reportToken:{$type:"string"}})')
for i in $(seq 1 240); do [ "$(q $ONLINE 'db.reports.countDocuments()')" = "$WANT" ] && break; sleep 2; done
check "every order with a report link is online" "$(q $ONLINE 'db.reports.countDocuments()')" "$WANT"
grep -q "Sync: .* failed\|Sync: .*error" /gold/logs/server.log && bad "sync errors in server.log" || ok "no sync errors"
for i in $(seq 1 60); do [ "$(q $ONLINE 'db.heartbeats.countDocuments()')" = 1 ] && break; sleep 2; done
check "the PC's heartbeat arrived" "$(q $ONLINE 'db.heartbeats.countDocuments()')" 1
check "  with the app's version" "$(q $ONLINE 'db.heartbeats.findOne().version')" "1.0.0"
check "no phone number online" "$(q $ONLINE 'db.reports.countDocuments({contact:{$exists:true}})')" 0

echo "== a memo's QR link and the memo + code search, over HTTPS =="
read -r TOKEN CODE MEMO <<< "$(q $SHOP 'const o=db.orders.aggregate([{$match:{reportToken:{$type:"string"},voucher:{$type:"number"},deletedAt:null}},{$sample:{size:1}}]).toArray()[0]; o.reportToken+" "+o.reportCode+" "+o.voucher')"
check "QR link opens the report" "$(curl -s -o /tmp/r.html -w '%{http_code}' $SITE/r/$TOKEN)" 200
grep -q "$MEMO" /tmp/r.html && ok "  it shows memo $MEMO" || bad "  memo number not on the report page"
check "memo + code finds the same report" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$SITE/report?memo=$MEMO&code=$CODE")" "303 $SITE/r/$TOKEN"
check "the same link over http goes to https" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://sylhethallmark.com/r/$TOKEN)" "301 $SITE/r/$TOKEN"
quit

echo "== publishing an update (scripts/publish-desktop.sh; ssh/scp stand-ins copy locally) =="
mkdir -p /tmp/shim && cat > /tmp/shim/ssh <<'EOS'
#!/bin/bash
while [[ "$1" == -* ]]; do shift 2; done; shift; bash -c "cd / && $*"
EOS
cat > /tmp/shim/scp <<'EOS'
#!/bin/bash
args=(); while [ $# -gt 0 ]; do case "$1" in -P|-o) shift 2;; -q) shift;; *) args+=("$1"); shift;; esac; done
cp "${args[0]}" "${args[1]#*:}"
EOS
chmod +x /tmp/shim/ssh /tmp/shim/scp
node -e '
const c=require("crypto"),fs=require("fs");const k=c.generateKeyPairSync("ed25519");
fs.writeFileSync("/tmp/up-pub.pem",k.publicKey.export({type:"spki",format:"pem"}));
fs.writeFileSync("/tmp/up-priv.pem",k.privateKey.export({type:"pkcs8",format:"pem"}));'
mkdist() { # mkdist <dir> <signed|tampered>
  rm -rf "$1" && mkdir -p "$1"
  head -c 3000000 /dev/urandom > "$1/SylhetGoldHallmark-Setup-1.0.1.exe"
  node -e '
const fs=require("fs"),c=require("crypto");const {signInstaller}=require("/repo/desktop/src/updates");
(async()=>{const d=process.argv[1],f=d+"/SylhetGoldHallmark-Setup-1.0.1.exe";
fs.writeFileSync(f+".sig",JSON.stringify(await signInstaller(f,"1.0.1",fs.readFileSync("/tmp/up-priv.pem","utf8"))));
if(process.argv[2]==="tampered") fs.appendFileSync(f,"evil");
const b=fs.readFileSync(f);const sha=c.createHash("sha512").update(b).digest("base64");
fs.writeFileSync(d+"/latest.yml",`version: 1.0.1\nfiles:\n  - url: SylhetGoldHallmark-Setup-1.0.1.exe\n    sha512: ${sha}\n    size: ${b.length}\npath: SylhetGoldHallmark-Setup-1.0.1.exe\nsha512: ${sha}\nreleaseDate: 2026-11-26T00:00:00.000Z\n`);})();' "$1" "$2"
}
export PUBLISH_PUBKEY_FILE=/tmp/up-pub.pem
mkdist /tmp/bad tampered
PATH=/tmp/shim:$PATH bash /repo/scripts/publish-desktop.sh me@site /releases /tmp/bad > /tmp/pub-bad.txt 2>&1 && bad "tampered update was published" || ok "publish refuses a tampered installer"
grep -q "NOT published" /tmp/pub-bad.txt && ok "  and says why" || bad "  no reason given"
check "  nothing on the site" "$(curl -s -o /dev/null -w '%{http_code}' $SITE/desktop/latest.yml)" 404
mkdist /tmp/good signed
PATH=/tmp/shim:$PATH bash /repo/scripts/publish-desktop.sh me@site /releases /tmp/good && ok "publish a signed update" || bad "publish"
check "  latest.yml on the site says 1.0.1" "$(curl -s $SITE/desktop/latest.yml | sed -n 's/^version: //p')" "1.0.1"
check "  no half-uploaded files left" "$(ls /releases | grep -c '\.part$')" 0
cp /releases/latest.yml /releases/latest-linux.yml # this Linux test app reads latest-linux.yml

echo "== the shop app finds it at the default address and accepts it =="
check "settings use the default update address" "$(node -e 'console.log(require("/repo/desktop/src/paths").readSettings("/gold/settings.json").updateUrl)')" "$SITE/desktop/"
: > /gold/logs/app.log; rm -rf /root/.cache/sylhet-gold-hallmark-updater
GOLD_UPDATE_TEST=1 GOLD_UPDATE_PUBKEY_FILE=/tmp/up-pub.pem launch
ready 1 || bad "start for update"
waitlog "update: 1.0.1 \(checked and ready\|REFUSED\|not accepted\)" /gold/logs/app.log 120
check "update downloaded over HTTPS, signature checked, ready" "$(grep -c 'update: 1.0.1 checked and ready' /gold/logs/app.log)" 1
check "  backup taken before it" "$(ls /gold/backups | grep -c 'before-update-1.0.1.gz')" 1
quit

echo "== the full smoke test =="
SMOKE_MIN_CERT_DAYS=0 bash /repo/scripts/smoke-online.sh $SITE > /tmp/smoke2.txt
cat /tmp/smoke2.txt
check "smoke test with an update published" "$(tail -1 /tmp/smoke2.txt | grep -o '[0-9]* fail')" "0 fail"
echo "TOTAL: $PASS pass, $FAIL fail"

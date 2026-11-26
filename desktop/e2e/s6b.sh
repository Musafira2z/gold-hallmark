#!/bin/bash
# S6b end-to-end (Plan 22): backups, bringing real data over, signed updates.
# Needs: the S6a setup (see run.sh), and a copy of the test database + its photos in /src:
#   docker compose -f compose.dev.yml exec -T mongo mongodump --db=goldhallmark_dev --archive --gzip > /tmp/p22src/dev.gz
#   cp -r .dev-uploads /tmp/p22src/photos
#   docker run --rm --entrypoint bash -v $PWD:/repo -v /tmp/p22src:/src:ro gold-desktop-e2e /repo/desktop/e2e/s6b.sh
set -uo pipefail
cd /repo/desktop
CDP=/repo/desktop/e2e/cdp.js
export GOLD_DATA_DIR=/gold
mkdir -p mongo && for t in mongod mongodump mongorestore; do cp "$(command -v $t)" mongo/; done
trap "rm -rf /repo/desktop/mongo" EXIT
PASS=0; FAIL=0
ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: got '$2', want '$3'"; fi; }
API=http://127.0.0.1:47111
APP=""
launch() { xvfb-run -a npx electron --no-sandbox --remote-debugging-port=9333 . "$@" >>/tmp/electron.out 2>&1 & APP=$!; }
ready() { local n=$1; for i in $(seq 1 180); do [ "$(grep -c "Ready." /gold/logs/app.log 2>/dev/null)" -ge "$n" ] && return 0; sleep 1; done; return 1; }
gone() { for i in $(seq 1 90); do pgrep -f "dist/electron --no-sandbox --remote" >/dev/null || return 0; sleep 1; done; return 1; }
quit() { node $CDP closeall >/dev/null 2>&1; gone; }
second() { xvfb-run -a npx electron --no-sandbox . "$@" >/dev/null 2>&1; }
waitlog() { for i in $(seq 1 ${3:-120}); do [ "$(grep -c "$1" "${2:-/gold/logs/app.log}" 2>/dev/null)" -ge 1 ] && return 0; sleep 1; done; return 1; }
q() { mongosh --quiet "mongodb://127.0.0.1:$1/goldhallmark" --eval "$2" | tail -1; }

echo "== old app's backup (the test copy, as the Docker app writes it) =="
rm -rf /tmp/srcdb /tmp/oldapp && mkdir -p /tmp/srcdb /tmp/oldapp
mongod --dbpath /tmp/srcdb --port 27999 --bind_ip 127.0.0.1 --logpath /tmp/srcdb.log --fork >/dev/null
mongorestore --uri=mongodb://127.0.0.1:27999 --archive=/src/dev.gz --gzip --quiet --nsFrom='goldhallmark_dev.*' --nsTo='goldhallmark.*'
# syncstates (how far the old PC synced) is not brought over on purpose.
COUNTS_JS='JSON.stringify(Object.fromEntries(db.getCollectionNames().filter(n=>!n.startsWith("system.")&&n!=="syncstates").sort().map(n=>[n,db.getCollection(n).countDocuments()])))'
SRC_COUNTS=$(q 27999 "$COUNTS_JS")
SRC_ORDERS=$(q 27999 'db.orders.countDocuments()')
SRC_MAXV=$(q 27999 'db.orders.find({voucher:{$gt:1000000}}).sort({voucher:-1}).limit(1).toArray().map(o=>o.voucher)[0]||1000000')
mongodump --uri=mongodb://127.0.0.1:27999 --db=goldhallmark --archive=/tmp/oldapp/goldhallmark-20261125-0900.gz --gzip --quiet
cp -r /src/photos /tmp/oldapp/photos
SRC_MISSING=$(q 27999 "const have=new Set($(ls /tmp/oldapp/photos | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(s.split("\n").filter(Boolean))))')); const ref=new Set(); for (const c of ['orders','users']) db.getCollection(c).find({image:{\$type:'string'}}).forEach(d=>{const m=d.image.match(/^\\/uploads\\/([^\\/\\\\]+)\$/); if(m) ref.add(m[1]);}); [...ref].filter(n=>!have.has(n)).length")
mongosh --quiet mongodb://127.0.0.1:27999/admin --eval 'db.shutdownServer()' >/dev/null 2>&1
echo "source: orders $SRC_ORDERS, max memo $SRC_MAXV, missing photos $SRC_MISSING"

echo "== fresh app: backup at start =="
rm -rf /gold /root/.cache/sylhet-gold-hallmark-updater
launch
ready 1 && ok "app started" || bad "start"
waitlog "backup: OK: goldhallmark-" && ok "backup taken at start" || bad "no backup at start"
check "  checked, good name" "$(ls /gold/backups | grep -cE '^goldhallmark-[0-9]{8}-[0-9]{4}\.gz$')" 1
check "  weekly copy" "$(ls /gold/backups/weekly | grep -c week)" 1
check "  written to backup-log.txt" "$(grep -c 'OK: goldhallmark-' /gold/backups/backup-log.txt)" 1

echo "== bringing data into a non-empty app is refused =="
PW="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)Aa1"
check "owner made in the new app" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/setup -H 'Content-Type: application/json' -d "{\"name\":\"Tester\",\"username\":\"tester\",\"password\":\"$PW\"}")" 201
second --import /tmp/oldapp/goldhallmark-20261125-0900.gz
waitlog "import: This app already has data" && ok "refused, nothing overwritten" || bad "not refused"
check "  still only the one staff account" "$(q 47117 'db.staffs.countDocuments()')" 1
second --backup-now
waitlog "backup-now: OK" && ok "Back up now (second start)" || bad "backup-now"
quit

echo "== new PC: bring the old app's data over =="
rm -rf /gold; : > /tmp/electron.out
launch --import /tmp/oldapp/goldhallmark-20261125-0900.gz
ready 1 && ok "app started with --import" || bad "start for import"
for i in $(seq 1 300); do ls /gold/logs/import-*.txt >/dev/null 2>&1 && break; sleep 1; done
R=$(ls /gold/logs/import-*.txt 2>/dev/null | head -1)
[ -n "$R" ] && ok "import report written" || bad "no import report"
sed -n '1,40p' "$R"
grep -q "RESULT: PROBLEM" "$R" && bad "report says PROBLEM" || ok "report: no problem"
check "every collection count equals the old database" "$(q 47117 "$COUNTS_JS")" "$SRC_COUNTS"
check "photos missing = same as in the old app (none lost)" "$(sed -n 's/.*photo file missing: \([0-9]*\).*/\1/p' "$R")" "$SRC_MISSING"
check "photos copied" "$(ls /gold/photos | wc -l)" "$(ls /tmp/oldapp/photos | wc -l)"
waitlog "backup: OK: goldhallmark-" /gold/logs/app.log 120 && ok "first backup after import" || bad "no backup after import"
check "  it holds every order" "$(grep -o 'orders [0-9]*' /gold/backups/backup-log.txt | tail -1)" "orders $SRC_ORDERS"
OU=$(sed -n "s/^owner: \([^ ]*\) \/ .*/\1/p" /repo/.test-accounts); OP=$(sed -n "s/^owner: [^ ]* \/ //p" /repo/.test-accounts)
T=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "$(node -e 'console.log(JSON.stringify({username:process.argv[1],password:process.argv[2]}))' "$OU" "$OP")" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).token||"")}catch{console.log("")}})')
[ -n "$T" ] && ok "the old owner account logs in" || bad "old owner login"
V=$(curl -s -X POST $API/orders -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"S6b Test","customerID":"441","type":"hallmark","paidAmount":"0","items":"[{\"item\":\"Ring\",\"quantity\":1,\"rate\":40}]"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).voucher)}catch{console.log(s.slice(0,100))}})')
check "memo numbers continue after the old ones" "$V" "$((SRC_MAXV + 1))"
quit

echo "== updates =="
node -e '
const c=require("crypto"),fs=require("fs");
const k=c.generateKeyPairSync("ed25519");
fs.writeFileSync("/tmp/up-pub.pem",k.publicKey.export({type:"spki",format:"pem"}));
fs.writeFileSync("/tmp/up-priv.pem",k.privateKey.export({type:"pkcs8",format:"pem"}));'
mkup() { # mkup <signed|tampered|unsigned>
  rm -rf /tmp/upd && mkdir -p /tmp/upd
  head -c 300000 /dev/urandom > /tmp/upd/SylhetGoldHallmark-Setup-1.0.1.exe
  node -e '
const fs=require("fs"),c=require("crypto");const {signInstaller}=require("/repo/desktop/src/updates");
(async()=>{const f="/tmp/upd/SylhetGoldHallmark-Setup-1.0.1.exe";
const sig=await signInstaller(f,"1.0.1",fs.readFileSync("/tmp/up-priv.pem","utf8"));
if(process.argv[1]==="tampered"){fs.appendFileSync(f,"evil");}
if(process.argv[1]!=="unsigned") fs.writeFileSync(f+".sig",JSON.stringify(sig));
const b=fs.readFileSync(f);const sha=c.createHash("sha512").update(b).digest("base64");
for (const ch of ["latest.yml","latest-linux.yml"]) fs.writeFileSync("/tmp/upd/"+ch,`version: 1.0.1\nfiles:\n  - url: SylhetGoldHallmark-Setup-1.0.1.exe\n    sha512: ${sha}\n    size: ${b.length}\npath: SylhetGoldHallmark-Setup-1.0.1.exe\nsha512: ${sha}\nreleaseDate: 2026-11-25T00:00:00.000Z\n`);})();' "$1"
}
node -e 'const h=require("http"),fs=require("fs"),p=require("path");h.createServer((q,r)=>{const f=p.join("/tmp/upd",decodeURIComponent(q.url.split("?")[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200);r.end(d);}})}).listen(47199,"127.0.0.1")' & WEB=$!
node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync("/gold/settings.json"));s.updateUrl="http://127.0.0.1:47199/";fs.writeFileSync("/gold/settings.json",JSON.stringify(s,null,2))'
export GOLD_UPDATE_TEST=1 GOLD_UPDATE_PUBKEY_FILE=/tmp/up-pub.pem
for kind in signed tampered unsigned; do
  mkup $kind; : > /gold/logs/app.log; rm -rf /root/.cache/sylhet-gold-hallmark-updater
  launch
  ready 1 || bad "start ($kind)"
  waitlog "update: 1.0.1 \(checked and ready\|REFUSED\)" /gold/logs/app.log 90
  case $kind in
    signed)   check "signed update: accepted" "$(grep -c 'update: 1.0.1 checked and ready' /gold/logs/app.log)" 1
              check "  backup taken before it" "$(ls /gold/backups | grep -c 'before-update-1.0.1.gz')" 1 ;;
    tampered) check "tampered update: refused" "$(grep -c 'update: 1.0.1 REFUSED (the file is not the one that was signed)' /gold/logs/app.log)" 1 ;;
    unsigned) check "unsigned update: refused" "$(grep -c 'update: 1.0.1 REFUSED (no signature)' /gold/logs/app.log)" 1 ;;
  esac
  quit
done
check "after a refused update nothing is left to install" "$(grep -c 'ready, but not installed' /gold/logs/app.log)" 0
kill $WEB 2>/dev/null
echo "TOTAL: $PASS pass, $FAIL fail"

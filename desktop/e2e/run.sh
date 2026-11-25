#!/bin/bash
# Desktop app end-to-end (Plan 21): the whole app on Linux, on a virtual screen, with a fresh data folder.
# From the repo root on the test server:
#   docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/repo -w /repo node:20 bash desktop/prepare.sh linux
#   (cd desktop && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/d -w /d node:20 npm ci)
#   docker build -t gold-desktop-e2e desktop/e2e
#   docker run --rm --entrypoint bash -v $PWD:/repo gold-desktop-e2e /repo/desktop/e2e/run.sh
set -uo pipefail
cd /repo/desktop
CDP=/repo/desktop/e2e/cdp.js
export GOLD_DATA_DIR=/gold
rm -rf /gold
mkdir -p mongo && cp "$(command -v mongod)" mongo/mongod && trap "rm -rf /repo/desktop/mongo" EXIT
PASS=0; FAIL=0
ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: got '$2', want '$3'"; fi; }
API=http://127.0.0.1:47111; UI=http://127.0.0.1:47110
APP=""
launch() { xvfb-run -a npx electron --no-sandbox --remote-debugging-port=9333 . >/tmp/electron.out 2>&1 & APP=$!; }
launches=0
ready() { launches=$((launches+1)); for i in $(seq 1 120); do [ "$(grep -c "Ready." /gold/logs/app.log 2>/dev/null)" -ge "$launches" ] && return 0; grep -q "ERROR" /gold/logs/app.log 2>/dev/null && return 1; sleep 1; done; return 1; }
gone() { for i in $(seq 1 60); do pgrep -f "electron --no-sandbox" >/dev/null || return 0; sleep 1; done; return 1; }
quit() { node $CDP closeall >/dev/null 2>&1; gone; }          # a person closing every window
stopsig() { pkill -TERM -f "dist/electron --no-sandbox --remote"; gone; }   # Windows shutting down

echo "== first start (fresh PC) =="
launch
ready && ok "app started" || { bad "app did not start"; cat /gold/logs/app.log /tmp/electron.out | tail -30; }
check "settings.json made with defaults" "$(node -e 'const s=require("/gold/settings.json");console.log(s.syncUrl===""&&s.reportBaseUrl==="https://sylhethallmark.com")')" true
check "data folders" "$(ls /gold | tr '\n' ' ')" "backups db logs photos settings.json "
check "screens served" "$(curl -s $UI/ | grep -c '<div id="root">')" 1
check "app route -> screens" "$(curl -s $UI/orders | grep -c '<div id="root">')" 1
check "server answers" "$(curl -s -o /dev/null -w '%{http_code}' $API/)" 200
ss -ltn | grep -E ':(47110|47111|47117) ' | grep -v '127.0.0.1'
check "only this PC (no 0.0.0.0 listeners on app ports)" "$(ss -ltn | grep -E ':(47110|47111|47117) ' | grep -vc '127.0.0.1')" 0
sleep 3
check "window shows the shop screens" "$(node $CDP list | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=JSON.parse(s);console.log(l.length+" "+l[0].url)})')" "1 http://127.0.0.1:47110/"
check "screens talk to this server" "$(node $CDP eval 'fetch("http://127.0.0.1:47111/auth/status").then(r=>r.json()).then(j=>j.setupNeeded)')" true

echo "== owner setup, customer, order with photo =="
PW="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)Aa1"
TOKEN=$(curl -s -X POST $API/auth/setup -H 'Content-Type: application/json' -d "{\"name\":\"Test Owner\",\"username\":\"owner\",\"password\":\"$PW\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token||""))')
[ -n "$TOKEN" ] && ok "owner made" || bad "owner setup"
A="Authorization: Bearer $TOKEN"
CID=$(curl -s -X POST $API/users/create -H "$A" -F name="Desk Test" -F contact=01700000000 -F customerID=1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.customerID??j.user?.customerID??j.data?.customerID??("ERR "+s.slice(0,200)))})')
echo "customer: $CID"
cp /repo/desktop/build/icon.png /tmp/photo.png
O=$(curl -s -X POST $API/orders -H "$A" -F name="Desk Test" -F customerID="$CID" -F type=hallmark -F paidAmount=0 \
  -F 'items=[{"item":"Ring","quantity":1,"rate":40,"xray":"22K 916"}]' -F image=@/tmp/photo.png)
OID=$(echo "$O" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j._id||("ERR "+s.slice(0,200)))})')
IMG=$(echo "$O" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).image||""))')
check "order saved, memo 1000001" "$(echo "$O" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).voucher))')" 1000001
check "photo is in the app's photo folder" "$(ls /gold/photos | wc -l)" 1
check "photo served to staff" "$(curl -s -o /dev/null -w '%{http_code}' $API$IMG -H "$A")" 200
check "QR link uses the domain" "$(curl -s $API/orders/$OID -H "$A" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).reportUrl.replace(/[^/]+$/,"")))')" "https://sylhethallmark.com/r/"
node $CDP eval "window.open('http://127.0.0.1:47110/invoice/$OID?view=1','_blank'); true" >/dev/null
sleep 4
check "memo opens in its own app window" "$(node $CDP list | grep -o '/invoice/' | head -1)" "/invoice/"
node $CDP eval "window.open('https://example.com/','_blank'); true" >/dev/null; sleep 2
check "website links don't open inside the app" "$(node $CDP list | grep -c example.com)" 0

echo "== second double-click =="
xvfb-run -a npx electron --no-sandbox . >/tmp/second.out 2>&1; check "second copy exits at once" "$?" 0
check "  data folder log shows one start" "$(grep -c 'Starting version' /gold/logs/app.log)" 1

echo "== close and open again =="
quit && ok "app closed" || bad "app did not close"
check "MongoDB shut down cleanly" "$(grep -c 'MongoDB stopped cleanly' /gold/logs/app.log)" 1
check "no MongoDB left running" "$(pgrep -xc mongod)" 0
echo "== after a crash: MongoDB left running =="
mongod --dbpath /gold/db --port 47117 --bind_ip 127.0.0.1 --logpath /tmp/orphan.log --fork >/dev/null
launch
ready && ok "opens, using the MongoDB that was left" || bad "open after crash"
check "  said so in the log" "$(grep -c 'already running on port 47117' /gold/logs/app.log)" 1
quit
check "  and shut it down cleanly on close" "$(pgrep -xc mongod) $(grep -c 'MongoDB stopped cleanly' /gold/logs/app.log)" "0 2"
tail -6 /gold/logs/app.log
launch
ready && ok "opened again" || bad "second open"
check "no unclean-shutdown recovery" "$(grep -ci 'unclean shutdown' /gold/logs/mongod.log)" 0
TOKEN2=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"owner\",\"password\":\"$PW\"}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token||""))')
check "order still there" "$(curl -s $API/orders/$OID -H "Authorization: Bearer $TOKEN2" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).voucher))')" 1000001
check "photo still there" "$(curl -s -o /dev/null -w '%{http_code}' $API$IMG -H "Authorization: Bearer $TOKEN2")" 200

echo "== Windows shutting down (stop signal) =="
stopsig && ok "app stopped" || bad "app did not stop"
check "MongoDB shut down cleanly again" "$(grep -c 'MongoDB stopped cleanly' /gold/logs/app.log)" 3
check "no MongoDB left running" "$(pgrep -xc mongod)" 0

echo "== server port busy =="
nc -l 127.0.0.1 47111 >/dev/null 2>&1 & NC=$!
sleep 1; : > /gold/logs/app.log; launches=0
launch; sleep 15
check "clear message, not a blank window" "$(grep -c 'Port 47111 (server) is used by another program' /gold/logs/app.log)" 1
node $CDP list | head -c 300; echo
check "  shown in the window" "$(node $CDP list | grep -c 'Problem')" 1
quit; kill $NC 2>/dev/null
echo "TOTAL: $PASS pass, $FAIL fail"

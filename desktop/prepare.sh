#!/usr/bin/env bash
# Gets the parts the desktop app ships with (Plan 21). Run from the repo root, in node:20:
#   bash desktop/prepare.sh win     -> Windows parts (installer)
#   bash desktop/prepare.sh linux   -> Linux parts (tests on the test server; mongod is added by the test)
set -euo pipefail
TARGET="${1:-win}"
MONGO_VERSION="7.0.48"   # same as the Docker app's mongo:7
TOOLS_VERSION="100.20.1" # mongodump / mongorestore for backups (Plan 22)
TOOLS_SHA256="5a1a8aa2c87ca0685ffdcad403601b110d495d44afe579473b8f75ec46621c80"  # from downloads.mongodb.org/tools/db/release.json
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="$ROOT/desktop"

echo "== shop screens =="
rm -rf "$D/app-client"
# Built from a clean copy, so the client folder you work in is never touched.
CB="$(mktemp -d)"
( cd "$ROOT/client" && tar cf - --exclude=node_modules --exclude=dist . ) | ( cd "$CB" && tar xf - )
( cd "$CB" && npm ci --silent && VITE_API_URL="http://127.0.0.1:47111" npx vite build --outDir "$D/app-client" --emptyOutDir >/dev/null )
rm -rf "$CB"

echo "== server ($TARGET) =="
rm -rf "$D/app-server"
mkdir -p "$D/app-server"
( cd "$ROOT/server" && tar cf - --exclude=node_modules --exclude=test --exclude=uploads --exclude=.env . ) | ( cd "$D/app-server" && tar xf - )
if [ "$TARGET" = win ]; then
  ( cd "$D/app-server" && npm ci --omit=dev --silent --os=win32 --cpu=x64 )
else
  ( cd "$D/app-server" && npm ci --omit=dev --silent )
fi

if [ "$TARGET" = win ]; then
  echo "== MongoDB $MONGO_VERSION for Windows =="
  rm -rf "$D/mongo" && mkdir -p "$D/mongo"
  ZIP="mongodb-windows-x86_64-$MONGO_VERSION.zip"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/$ZIP" "https://fastdl.mongodb.org/windows/$ZIP"
  curl -fsSL -o "$TMP/$ZIP.sha256" "https://fastdl.mongodb.org/windows/$ZIP.sha256"
  ( cd "$TMP" && sha256sum -c "$ZIP.sha256" )
  python3 - "$TMP/$ZIP" "$D/mongo" <<'PY'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    base = os.path.basename(n)
    if ("/bin/" in n and base == "mongod.exe") or base == "LICENSE-Community.txt":
        open(os.path.join(sys.argv[2], base), "wb").write(z.read(n))
        print("took", n)
PY
  rm -rf "$TMP"

  echo "== MongoDB Database Tools $TOOLS_VERSION for Windows (backups) =="
  TZIP="mongodb-database-tools-windows-x86_64-$TOOLS_VERSION.zip"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/$TZIP" "https://fastdl.mongodb.org/tools/db/$TZIP"
  echo "$TOOLS_SHA256  $TMP/$TZIP" | sha256sum -c -
  python3 - "$TMP/$TZIP" "$D/mongo" <<'PY'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    base = os.path.basename(n)
    if "/bin/" in n and base in ("mongodump.exe", "mongorestore.exe"):
        open(os.path.join(sys.argv[2], base), "wb").write(z.read(n))
        print("took", n)
    if base == "LICENSE.md":
        open(os.path.join(sys.argv[2], "LICENSE-tools.md"), "wb").write(z.read(n))
PY
  rm -rf "$TMP"

  echo "== Microsoft Visual C++ runtime installer (mongod.exe needs it) =="
  curl -fsSL -o "$D/build/vc_redist.x64.exe" "https://aka.ms/vs/17/release/vc_redist.x64.exe"
  sha256sum "$D/build/vc_redist.x64.exe"
fi
echo "parts ready"

#!/bin/bash
# Puts a desktop app update on the website (Plan 23). Run on the test server, after the Windows build.
#   scripts/publish-desktop.sh <user@host> <folder on the website>   [dist folder, default desktop/dist]
#   e.g. scripts/publish-desktop.sh u123456789@1.2.3.4 domains/sylhethallmark.com/desktop-releases
# Optional: PUBLISH_SSH_PORT (Hostinger uses 65002).
#           PUBLISH_PUBKEY_FILE: check with this public key instead of the app's (rehearsal only).
# Steps: check the signature with the key built into the app, upload the installer and its .sig,
# and only then latest.yml, so no shop PC sees a version before its file is complete.
# Older installers are kept on the website.
set -euo pipefail
TARGET="${1:?Give user@host}"
DIR="${2:?Give the folder on the website}"
DIST="${3:-$(dirname "$0")/../desktop/dist}"
PORT="${PUBLISH_SSH_PORT:-22}"
DESKTOP="$(cd "$(dirname "$0")/../desktop" && pwd)"

YML="$DIST/latest.yml"
[ -f "$YML" ] || { echo "No $YML. Build the Windows installer first."; exit 1; }
VERSION=$(sed -n 's/^version: *//p' "$YML")
FILE=$(sed -n 's/^path: *//p' "$YML")
[ -n "$VERSION" ] && [ -n "$FILE" ] && [ -f "$DIST/$FILE" ] || { echo "latest.yml does not name an installer that is here"; exit 1; }
[ -f "$DIST/$FILE.sig" ] || (cd "$DESKTOP" && node sign-update.js "$DIST/$FILE")

# The same check the shop PC makes, with the key inside the app.
node -e '
const { verifyInstaller } = require(process.argv[1] + "/src/updates");
const sig = JSON.parse(require("fs").readFileSync(process.argv[2] + ".sig", "utf8"));
const key = process.env.PUBLISH_PUBKEY_FILE ? require("fs").readFileSync(process.env.PUBLISH_PUBKEY_FILE, "utf8") : undefined;
verifyInstaller(process.argv[2], sig, key, process.argv[3]).then((r) => {
  if (!r.ok) { console.error("NOT published: " + r.why); process.exit(1); }
  console.log("Signature OK for " + process.argv[3]);
});' "$DESKTOP" "$DIST/$FILE" "$VERSION"

SSH=(ssh -p "$PORT" -o BatchMode=yes "$TARGET")
SCP=(scp -P "$PORT" -o BatchMode=yes -q)
"${SSH[@]}" "mkdir -p '$DIR'"
echo "Uploading $FILE ($(du -h "$DIST/$FILE" | cut -f1))..."
"${SCP[@]}" "$DIST/$FILE" "$TARGET:$DIR/$FILE.part"
"${SCP[@]}" "$DIST/$FILE.sig" "$TARGET:$DIR/$FILE.sig.part"
"${SCP[@]}" "$YML" "$TARGET:$DIR/latest.yml.part"
# Same size on both ends, then switch: installer and .sig first, latest.yml last.
LOCAL=$(stat -c %s "$DIST/$FILE")
REMOTE=$("${SSH[@]}" "stat -c %s '$DIR/$FILE.part'")
[ "$LOCAL" = "$REMOTE" ] || { echo "Upload size differs ($REMOTE of $LOCAL). latest.yml NOT changed."; exit 1; }
"${SSH[@]}" "cd '$DIR' && mv -f '$FILE.part' '$FILE' && mv -f '$FILE.sig.part' '$FILE.sig' && mv -f latest.yml.part latest.yml"
echo "Published $VERSION. Shop PCs will find it within 6 hours (or at the next start)."

# Desktop app (Windows)

The shop app as one Windows program (Plan 21). No Docker needed on the shop PC.

When it opens, it starts:

| Part | Port (this PC only) |
|---|---|
| MongoDB 7 (`mongod.exe`, inside the installer) | 127.0.0.1:47117 |
| Server (`server/`, run by Electron's own Node) | 127.0.0.1:47111 |
| Shop screens (`client/` build) | 127.0.0.1:47110 |

The ports are different from the Docker app (3001 / 5000 / 27017), so both can run on install day.

## Data: `C:\SylhetGold\`

| Folder | What |
|---|---|
| `db\` | the database |
| `photos\` | customer and memo photos |
| `backups\` | backups: every 6 h, newest 14 + 8 weekly, each one checked; `photos\`, `weekly\`, `backup-log.txt` |
| `logs\` | `app.log`, `server.log`, `mongod.log` |
| `settings.json` | `syncUrl`, `syncKey` (the website, S7), `reportBaseUrl` (the memo QR link), `updateUrl` (where updates come from), `backupCopyDir` (optional second copy of backups, e.g. Google Drive / pen drive) |

Uninstalling or updating never deletes this folder. After changing `settings.json`, close and open the app.

## Backups and bringing data over (Plan 22)

- Menu **Backup**: Back up now · Open the backups folder · Bring data from the old app…
- An empty app asks once: bring the old app's data, or start new.
- **Bringing data over** works only into an empty app (never overwrites). Give it a Docker backup
  (`goldhallmark-….gz`); photos come from the `photos` folder next to it. The report is in `logs\import-<time>.txt`.
  The same works for the app's own backups on a new PC.
- From the command line (install day):

```bat
"%LOCALAPPDATA%\Programs\Sylhet Gold Hallmark\Sylhet Gold Hallmark.exe" --import=D:\backups\goldhallmark-20261201-0900.gz
"%LOCALAPPDATA%\Programs\Sylhet Gold Hallmark\Sylhet Gold Hallmark.exe" --backup-now
```

## Updates (Plan 22)

The app checks `updateUrl` (default `https://sylhethallmark.com/desktop/`) 1 minute after start and every 6 hours.
It installs an update **only if it carries our signature**, takes a backup first, and installs when the app is closed.

**Signing key:** `desktop/.update-signing-key.pem` on the test server (git-ignored). Keep a safe copy.
If it is lost, no update can be published; the shop would need a manual reinstall with a new key.

**Publish a new version:**
1. Raise `version` in `desktop/package.json`.
2. Build (below).
3. `docker run --rm --user $(id -u):$(id -g) -v $PWD/desktop:/d -w /d node:20 node sign-update.js dist/SylhetGoldHallmark-Setup-<version>.exe`
4. Upload `latest.yml`, the `.exe`, its `.blockmap` and its `.sig` to the website's `desktop/` folder.

## Build the Windows installer (on the test server)

```bash
# 1. parts: screens, server with Windows packages, MongoDB for Windows (checksum checked)
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/repo -w /repo node:20 bash desktop/prepare.sh win
# 2. installer -> desktop/dist/SylhetGoldHallmark-Setup-<version>.exe
docker run --rm -e HOME=/tmp -v $PWD/desktop:/project -w /project electronuserland/builder:wine \
  sh -c "npm ci --silent && npx electron-builder --win nsis --x64; chown -R $(id -u):$(id -g) node_modules dist"
```

## Tests

- Unit: `cd desktop && npm test`
- The whole app on Linux (virtual screen): `e2e/run.sh` (Plan 21) and `e2e/s6b.sh` (Plan 22). How to run them is at the top of each file.

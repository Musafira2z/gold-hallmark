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
| `backups\` | backups (S6b) |
| `logs\` | `app.log`, `server.log`, `mongod.log` |
| `settings.json` | `syncUrl`, `syncKey` (the website, S7), `reportBaseUrl` (the memo QR link) |

Uninstalling or updating never deletes this folder. After changing `settings.json`, close and open the app.

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
- The whole app on Linux (virtual screen): see `plans/21-s6a-desktop-app.md`.

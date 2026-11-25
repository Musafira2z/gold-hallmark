// Sylhet Gold Hallmark desktop app (Plans 21, 22).
// Starts MongoDB, the server and the shop screens on this PC, and shows them in a window.
// Backs up by itself, brings data over from the old app, and updates itself safely.
const { app, BrowserWindow, Menu, shell, dialog, Notification } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { PORTS, folders, makeFolders, resource, readSettings } = require("./paths");
const { startMongo, portOpen, sleep, loadDriver } = require("./mongo");
const { serveScreens } = require("./screens");
const { Backups } = require("./backup");
const { importBackup, isEmpty } = require("./importer");
const { startUpdates } = require("./updates");

const UI = `http://127.0.0.1:${PORTS.ui}`;
const API = `http://127.0.0.1:${PORTS.api}`;
const DB_URI = `mongodb://127.0.0.1:${PORTS.db}`;
const f = folders();
const TITLE = "Sylhet Gold Hallmark";

let logStream = null;
const log = (...parts) => {
    const line = `${new Date().toISOString()} ${parts.join(" ")}\n`;
    process.stdout.write(line);
    if (logStream) logStream.write(line);
};

// "--import <file> [--photos <dir>]" and "--backup-now" also work from the command line
// (install day, and tests). A second start passes them to the open app.
// "--import=<file>" works too.
const argAfter = (argv, flag) => {
    const eq = argv.find((a) => a.startsWith(`${flag}=`));
    if (eq) return eq.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

// The arguments go along as data: Chromium may reorder the second start's own argv.
if (!app.requestSingleInstanceLock({ argv: process.argv })) {
    app.quit();
} else {
    let win = null;
    let mongo = null;
    let client = null; // MongoDB driver connection used by backups and import
    let server = null;
    let serverStopping = false;
    let screens = null;
    let backups = null;
    let updates = null;
    let settings = null;
    let ready = false;
    let importing = false;
    let quitting = false;

    const serverDir = () => resource(app.isPackaged, "app-server");
    const toolsDir = () => resource(app.isPackaged, "mongo");
    const iconPath = () => path.join(__dirname, "..", "build", "icon.png");

    const page = (title, body) =>
        `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#f5f1e6;font:16px 'Segoe UI',system-ui,sans-serif;color:#1d1708">
<div style="max-width:560px;padding:32px;text-align:center">${body}</div></body>`)}`;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const showError = (message) => {
        log("ERROR:", message);
        if (!win) return;
        win.loadURL(page("Problem", `
<h1 style="font-size:22px;color:#991b1b">The app could not start</h1>
<p>${esc(message)}</p>
<p style="color:#555">Close the app and open it again. If it happens again, send the files in<br><b>${esc(f.logs)}</b></p>`));
    };

    const tell = (message, detail = "", type = "info") =>
        dialog.showMessageBox(win || undefined, { type, title: TITLE, message, detail, buttons: ["OK"] }).catch(() => {});

    // ---- server ----
    const waitForServer = async () => {
        for (let i = 0; i < 120; i += 1) {
            if (server && server.exitCode !== null) throw new Error(`The server stopped while starting. See ${path.join(f.logs, "server.log")}`);
            const ok = await new Promise((resolve) => {
                http.get(`${API}/`, (res) => { res.resume(); resolve(res.statusCode === 200); })
                    .on("error", () => resolve(false));
            });
            if (ok) return;
            await sleep(500);
        }
        throw new Error("The server did not answer in 60 seconds.");
    };

    const startServer = () => {
        const out = fs.openSync(path.join(f.logs, "server.log"), "a");
        const child = spawn(process.execPath, [path.join(serverDir(), "server.js")], {
            cwd: serverDir(),
            windowsHide: true,
            stdio: ["ignore", out, out],
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: "1", // run Electron's own Node, no second program needed
                NODE_ENV: "production",
                PORT: String(PORTS.api),
                HOST: "127.0.0.1", // only this PC can reach the server
                MONGO_URI: `${DB_URI}/goldhallmark`,
                UPLOADS_DIR: f.photos,
                BACKUP_DIR: f.backups,
                APP_VERSION: app.getVersion(),
                SYNC_URL: settings.syncUrl,
                SYNC_KEY: settings.syncKey,
                REPORT_BASE_URL: settings.reportBaseUrl,
            },
        });
        child.on("exit", (code) => {
            log(`Server stopped (code ${code}).`);
            if (!quitting && !serverStopping && win) showError(`The server stopped (code ${code}). See ${path.join(f.logs, "server.log")}`);
        });
        return child;
    };

    const stopServer = async () => {
        if (!server || server.exitCode !== null) return;
        serverStopping = true;
        const gone = new Promise((resolve) => server.once("exit", resolve));
        server.kill();
        await Promise.race([gone, sleep(5000)]);
        serverStopping = false;
    };

    // ---- windows ----
    const allowOpen = ({ url }) => {
        if (url === "" || url === "about:blank" || url.startsWith(`${UI}/`)) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: { width: 900, height: 1000, autoHideMenuBar: true, icon: iconPath() },
            };
        }
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: "deny" };
    };
    const keepInside = (contents) => {
        contents.setWindowOpenHandler(allowOpen);
        contents.on("will-navigate", (event, url) => {
            if (!url.startsWith(`${UI}/`) && url !== UI && url !== "about:blank") {
                event.preventDefault();
                if (/^https?:\/\//i.test(url)) shell.openExternal(url);
            }
        });
    };

    // ---- backups ----
    const backupNow = async () => {
        if (!backups) return;
        const r = await backups.take("");
        if (r.ok) tell("Backup done", `${path.basename(r.file)}\nOrders: ${r.orders}, customers: ${r.customers}\n\nFolder: ${f.backups}`);
        else tell("The backup had a problem", `See ${path.join(f.backups, "backup-log.txt")}. Older backups were kept.`, "warning");
    };

    // ---- bringing data over ----
    const runImport = async (file, photosFrom) => {
        if (importing) return;
        importing = true;
        try {
            if (backups && backups.busy) await backups.busy.catch(() => {});
            const result = await importBackup({
                file, photosFrom, client, uri: DB_URI, toolsDir: toolsDir(), photosDir: f.photos, logsDir: f.logs, log,
                stopServer,
                startServer: async () => { server = startServer(); await waitForServer(); },
            });
            if (win) await win.loadURL(`${UI}/`);
            if (backups) backups.take("").catch(() => {});
            const head = result.ok
                ? (result.missing.length ? `All data brought over. ${result.missing.length} photo(s) are missing.` : "All data brought over. Every count is equal.")
                : "There was a PROBLEM bringing the data over.";
            const choice = await dialog.showMessageBox(win || undefined, {
                type: result.ok ? "info" : "error", title: TITLE, message: head,
                detail: result.rows.map((r) => `${r.name}: ${r.app} of ${r.file}`).join("\n"),
                buttons: ["OK", "Open the full report"],
            }).catch(() => ({ response: 0 }));
            if (choice.response === 1) shell.openPath(result.reportFile);
        } catch (error) {
            log(`import: ${error.message}`);
            tell("Data was not brought over", error.message, "warning");
        } finally {
            importing = false;
        }
    };

    const pickAndImport = async () => {
        if (!(await isEmpty(client))) {
            tell("This app already has data", "Bringing data over works only into an empty app, so nothing is ever overwritten.", "warning");
            return;
        }
        const pick = await dialog.showOpenDialog(win, {
            title: "Choose the old app's backup file",
            properties: ["openFile"],
            filters: [{ name: "Backup", extensions: ["gz"] }],
        });
        if (pick.canceled || !pick.filePaths[0]) return;
        const file = pick.filePaths[0];
        let photosFrom = path.join(path.dirname(file), "photos");
        if (!fs.existsSync(photosFrom)) {
            const p = await dialog.showOpenDialog(win, { title: "Choose the old app's photos folder", properties: ["openDirectory"] });
            photosFrom = p.canceled ? null : p.filePaths[0];
        }
        await runImport(file, photosFrom);
    };

    // An empty app asks once: bring the old data, or start new.
    const askIfEmpty = async () => {
        if (!(await isEmpty(client))) return;
        const r = await dialog.showMessageBox(win, {
            type: "question", title: TITLE,
            message: "This app has no data yet.",
            detail: "Bring all data from the old app (its backup file), or start new?",
            buttons: ["Bring data from the old app", "Start new"], defaultId: 0, cancelId: 1,
        }).catch(() => ({ response: 1 }));
        if (r.response === 0) await pickAndImport();
    };

    const runArgs = async (argv) => {
        const file = argAfter(argv, "--import");
        if (file) await runImport(path.resolve(file), argAfter(argv, "--photos"));
        if (argv.includes("--backup-now") && backups) {
            const r = await backups.take("");
            log(`backup-now: ${r.ok ? "OK" : "problem"}`);
        }
    };

    app.on("second-instance", (_e, chromiumArgv, _dir, data) => {
        const argv = data && Array.isArray(data.argv) ? data.argv : chromiumArgv;
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
        if (ready) runArgs(argv).catch((e) => log(`command: ${e.message}`));
    });

    // ---- updates ----
    const setupUpdates = () => {
        if (!settings.updateUrl) {
            log("update: off (no updateUrl)");
            return;
        }
        const test = !app.isPackaged && process.env.GOLD_UPDATE_TEST === "1";
        if (!app.isPackaged && !test) return; // not while developing
        const { NsisUpdater } = require("electron-updater");
        const updater = new NsisUpdater();
        if (test) {
            // While testing there is no installed app-update.yml; give the updater its own.
            const cfg = path.join(f.root, "test-app-update.yml");
            fs.writeFileSync(cfg, `provider: generic\nurl: ${settings.updateUrl}\nupdaterCacheDirName: sylhet-gold-hallmark-updater\n`);
            updater.forceDevUpdateConfig = true;
            updater.updateConfigPath = cfg;
        }
        updates = startUpdates({
            updater, url: settings.updateUrl, log,
            publicKey: test && process.env.GOLD_UPDATE_PUBKEY_FILE ? fs.readFileSync(process.env.GOLD_UPDATE_PUBKEY_FILE, "utf8") : undefined,
            firstCheckMs: test ? 3000 : 60000,
            beforeReady: async (version) => {
                if (!backups) return;
                const r = await backups.take(`-before-update-${version}`);
                if (!r.ok) throw new Error("the backup before the update failed");
            },
            onReady: (version) => {
                if (Notification.isSupported()) {
                    new Notification({ title: TITLE, body: `Update ${version} is ready. It will install when you close the app.` }).show();
                }
            },
        });
    };

    // ---- start ----
    const start = async () => {
        makeFolders(f);
        logStream = fs.createWriteStream(path.join(f.logs, "app.log"), { flags: "a" });
        log(`Starting version ${app.getVersion()}, data in ${f.root}`);

        win = new BrowserWindow({
            width: 1366, height: 820, show: false, title: TITLE, icon: iconPath(), autoHideMenuBar: true,
            webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        });
        win.maximize();
        win.once("ready-to-show", () => win.show());
        keepInside(win.webContents);
        win.on("closed", () => { win = null; });
        win.on("session-end", () => app.quit()); // Windows is logging off or shutting down
        await win.loadURL(page("Starting", `<h1 style="font-size:24px;margin:0 0 8px">${TITLE}</h1><p style="color:#6b5a2e">Starting… · চালু হচ্ছে…</p>`));

        try {
            settings = readSettings(f.settings);
            for (const [name, port] of [["screens", PORTS.ui], ["server", PORTS.api]]) {
                if (await portOpen(port)) throw new Error(`Port ${port} (${name}) is used by another program. Close it, or restart the PC.`);
            }
            mongo = await startMongo({
                mongod: path.join(toolsDir(), process.platform === "win32" ? "mongod.exe" : "mongod"),
                dbPath: f.db, logPath: path.join(f.logs, "mongod.log"), port: PORTS.db, serverDir: serverDir(), log,
            });
            const driver = loadDriver(serverDir());
            client = new driver.MongoClient(`${DB_URI}/?directConnection=true`);
            await client.connect();
            server = startServer();
            await waitForServer();
            screens = await serveScreens({ dir: resource(app.isPackaged, "app-client"), port: PORTS.ui });
            log("Ready.");
            await win.loadURL(`${UI}/`);
            ready = true;
            backups = new Backups({
                toolsDir: toolsDir(), uri: DB_URI, client, dir: f.backups, photosDir: f.photos,
                copyDir: settings.backupCopyDir || null, log,
            });
            const startArgs = process.argv;
            if (argAfter(startArgs, "--import")) await runArgs(startArgs);
            else {
                askIfEmpty().catch((e) => log(`ask: ${e.message}`));
                if (startArgs.includes("--backup-now")) await runArgs(startArgs);
            }
            backups.start();
            setupUpdates();
        } catch (error) {
            showError(error.message);
        }
    };

    // Close: finish a running backup, stop the server, shut MongoDB down cleanly,
    // then quit (or install a checked update).
    app.on("before-quit", (event) => {
        if (quitting) return;
        quitting = true;
        event.preventDefault();
        (async () => {
            log("Closing.");
            if (updates) updates.stop();
            if (backups) await backups.stop();
            if (screens) screens.close();
            await stopServer();
            if (client) await client.close().catch(() => {});
            if (mongo) await mongo.stop().catch((e) => log("MongoDB stop:", e.message));
            log("Closed.");
            if (updates && app.isPackaged && updates.installIfReady()) return;
            if (updates && updates.state.ready) log("update: ready, but not installed while developing");
            if (logStream) logStream.end();
            app.exit(0);
        })();
    });
    app.on("window-all-closed", () => app.quit());
    // Asked to stop from outside (Windows shutting down, Ctrl+C): close the same careful way.
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => app.quit());

    app.on("web-contents-created", (_e, contents) => keepInside(contents));

    app.whenReady().then(() => {
        Menu.setApplicationMenu(Menu.buildFromTemplate([
            {
                label: "Backup",
                submenu: [
                    { label: "Back up now", click: () => backupNow().catch((e) => log(e.message)) },
                    { label: "Open the backups folder", click: () => shell.openPath(f.backups) },
                    { type: "separator" },
                    { label: "Bring data from the old app…", click: () => pickAndImport().catch((e) => log(e.message)) },
                ],
            },
            { label: "View", submenu: [{ role: "reload" }, { type: "separator" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }, { type: "separator" }, { role: "toggleDevTools" }] },
            {
                label: "Help",
                submenu: [
                    { label: "Open the logs folder", click: () => shell.openPath(f.logs) },
                    { label: "Open settings.json", click: () => shell.openPath(f.settings) },
                    { label: `Version ${app.getVersion()}`, enabled: false },
                ],
            },
        ]));
        // Opens by itself when Windows starts.
        if (app.isPackaged && process.platform === "win32") app.setLoginItemSettings({ openAtLogin: true });
        start().catch((error) => {
            dialog.showErrorBox(TITLE, error.message);
            app.exit(1);
        });
    });
}

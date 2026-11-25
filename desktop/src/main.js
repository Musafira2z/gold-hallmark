// Sylhet Gold Hallmark desktop app (Plan 21).
// Starts MongoDB, the server and the shop screens on this PC, and shows them in a window.
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { PORTS, folders, makeFolders, resource, readSettings } = require("./paths");
const { startMongo, portOpen, sleep } = require("./mongo");
const { serveScreens } = require("./screens");

const UI = `http://127.0.0.1:${PORTS.ui}`;
const API = `http://127.0.0.1:${PORTS.api}`;
const f = folders();

let logStream = null;
const log = (...parts) => {
    const line = `${new Date().toISOString()} ${parts.join(" ")}\n`;
    process.stdout.write(line);
    if (logStream) logStream.write(line);
};

// One copy at a time: a second double-click brings the first window forward.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    let win = null;
    let mongo = null;
    let server = null;
    let screens = null;
    let quitting = false;

    app.on("second-instance", () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
    });

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

    // Wait until the server answers (it connects to the database first).
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

    const startServer = (settings) => {
        const serverDir = resource(app.isPackaged, "app-server");
        const out = fs.openSync(path.join(f.logs, "server.log"), "a");
        const child = spawn(process.execPath, [path.join(serverDir, "server.js")], {
            cwd: serverDir,
            windowsHide: true,
            stdio: ["ignore", out, out],
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: "1", // run Electron's own Node, no second program needed
                NODE_ENV: "production",
                PORT: String(PORTS.api),
                HOST: "127.0.0.1", // only this PC can reach the server
                MONGO_URI: `mongodb://127.0.0.1:${PORTS.db}/goldhallmark`,
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
            if (!quitting && win) showError(`The server stopped (code ${code}). See ${path.join(f.logs, "server.log")}`);
        });
        return child;
    };

    // Memo tabs open as app windows; anything else (the website) opens in the normal browser.
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

    const iconPath = () => path.join(__dirname, "..", "build", "icon.png");

    const start = async () => {
        makeFolders(f);
        logStream = fs.createWriteStream(path.join(f.logs, "app.log"), { flags: "a" });
        log(`Starting version ${app.getVersion()}, data in ${f.root}`);

        win = new BrowserWindow({
            width: 1366,
            height: 820,
            show: false,
            title: "Sylhet Gold Hallmark",
            icon: iconPath(),
            autoHideMenuBar: true,
            webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        });
        win.maximize();
        win.once("ready-to-show", () => win.show());
        keepInside(win.webContents);
        win.on("closed", () => { win = null; });
        win.on("session-end", () => app.quit()); // Windows is logging off or shutting down
        await win.loadURL(page("Starting", `<h1 style="font-size:24px;margin:0 0 8px">Sylhet Gold Hallmark</h1><p style="color:#6b5a2e">Starting… · চালু হচ্ছে…</p>`));

        try {
            const settings = readSettings(f.settings);
            for (const [name, port] of [["screens", PORTS.ui], ["server", PORTS.api]]) {
                if (await portOpen(port)) throw new Error(`Port ${port} (${name}) is used by another program. Close it, or restart the PC.`);
            }
            mongo = await startMongo({
                mongod: path.join(resource(app.isPackaged, "mongo"), process.platform === "win32" ? "mongod.exe" : "mongod"),
                dbPath: f.db,
                logPath: path.join(f.logs, "mongod.log"),
                port: PORTS.db,
                serverDir: resource(app.isPackaged, "app-server"),
                log,
            });
            server = startServer(settings);
            await waitForServer();
            screens = await serveScreens({ dir: resource(app.isPackaged, "app-client"), port: PORTS.ui });
            log("Ready.");
            await win.loadURL(`${UI}/`);
        } catch (error) {
            showError(error.message);
        }
    };

    // Close: stop the server, then shut MongoDB down cleanly, then quit.
    app.on("before-quit", (event) => {
        if (quitting) return;
        quitting = true;
        event.preventDefault();
        (async () => {
            log("Closing.");
            if (screens) screens.close();
            if (server && server.exitCode === null) {
                const gone = new Promise((resolve) => server.once("exit", resolve));
                server.kill();
                await Promise.race([gone, sleep(5000)]);
            }
            if (mongo) await mongo.stop().catch((e) => log("MongoDB stop:", e.message));
            log("Closed.");
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
            { label: "View", submenu: [{ role: "reload" }, { type: "separator" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }, { type: "separator" }, { role: "toggleDevTools" }] },
        ]));
        // Opens by itself when Windows starts.
        if (app.isPackaged && process.platform === "win32") app.setLoginItemSettings({ openAtLogin: true });
        start().catch((error) => {
            dialog.showErrorBox("Sylhet Gold Hallmark", error.message);
            app.exit(1);
        });
    });
}

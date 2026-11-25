// Where the app keeps its files (Plan 21).
// Data lives outside the install folder, so updating or uninstalling never touches it.
const path = require("path");
const fs = require("fs");
const os = require("os");

const PORTS = { ui: 47110, api: 47111, db: 47117 };

// C:\SylhetGold on Windows: the same for every Windows user, easy to find.
// GOLD_DATA_DIR changes it (tests).
const dataDir = () =>
    process.env.GOLD_DATA_DIR ||
    (process.platform === "win32" ? "C:\\SylhetGold" : path.join(os.homedir(), "SylhetGold"));

const folders = (root = dataDir()) => ({
    root,
    db: path.join(root, "db"),
    photos: path.join(root, "photos"),
    backups: path.join(root, "backups"),
    logs: path.join(root, "logs"),
    settings: path.join(root, "settings.json"),
});

const makeFolders = (f) => {
    for (const dir of [f.root, f.db, f.photos, f.backups, f.logs]) fs.mkdirSync(dir, { recursive: true });
};

// Parts shipped with the app: inside the installer they sit in resources/;
// while developing they are next to this folder.
const resource = (isPackaged, name) =>
    isPackaged ? path.join(process.resourcesPath, name) : path.join(__dirname, "..", name);

const DEFAULT_SETTINGS = {
    // The online website (S7). Empty = sync off; the shop works the same either way.
    syncUrl: "",
    syncKey: "",
    // The link printed in the memo's QR.
    reportBaseUrl: "https://sylhethallmark.com",
    // Where updates come from (Plan 22). Empty = no updates.
    updateUrl: "https://sylhethallmark.com/desktop/",
    // Optional second copy of each backup: a Google Drive folder or a pen drive. Empty = none.
    backupCopyDir: "",
};

// settings.json: made with the defaults on first start; unknown or broken values fall back to defaults.
const readSettings = (file) => {
    let saved = {};
    try {
        saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            fs.writeFileSync(file, JSON.stringify(DEFAULT_SETTINGS, null, 2));
        }
    }
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (typeof saved[key] === "string") out[key] = saved[key].trim();
    }
    return out;
};

module.exports = { PORTS, dataDir, folders, makeFolders, resource, readSettings, DEFAULT_SETTINGS };

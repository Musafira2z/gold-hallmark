// What the PC tells the website after each sync round (Plan 19): it is alive, its version,
// and its newest backup. BACKUP_DIR is the folder the backups land in (Docker: /backups).
const fs = require("fs/promises");
const path = require("path");

// Newest backup file (*.gz) in BACKUP_DIR, or null if there is none / no folder.
const newestBackup = async (dir = process.env.BACKUP_DIR) => {
    if (!dir) return null;
    let names;
    try {
        names = await fs.readdir(dir);
    } catch {
        return null;
    }
    let best = null;
    for (const name of names) {
        if (!/\.gz$/i.test(name)) continue;
        try {
            const st = await fs.stat(path.join(dir, name));
            if (st.isFile() && st.size > 0 && (!best || st.mtimeMs > best.at.getTime())) best = { name, at: st.mtime, size: st.size };
        } catch {
            // the file went away meanwhile
        }
    }
    return best;
};

const heartbeat = async ({ waiting = 0, now = new Date(), dir } = {}) => ({
    at: now,
    version: (process.env.APP_VERSION || "").slice(0, 40),
    waiting,
    backup: await newestBackup(dir),
});

module.exports = { newestBackup, heartbeat };

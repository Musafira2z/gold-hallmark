// Backups inside the desktop app (Plan 22). Same rules and file names as the Docker app's
// scripts/backup.sh (Plan 02), so both kinds of backup can be read the same way.
const { spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DB = "goldhallmark";
const CHECK_DB = `${DB}_backupcheck`;
const RULES = { everyMinutes: 360, keep: 14, keepWeekly: 8, minDropPercent: 50, checkEverySeconds: 300 };

// ---- small pure helpers (unit-tested) ----

// Bangladesh time, whatever the PC's clock zone is: YYYYMMDD-HHMM
const stamp = (date = new Date()) => {
    const d = new Date(date.getTime() + 6 * 3600e3); // Dhaka is UTC+6, no summer time
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
};
const GOOD = new RegExp(`^${DB}-\\d{8}-\\d{4}\\.gz$`);
const ANY_ATTEMPT = new RegExp(`^${DB}-\\d{8}-\\d{4}(\\.CHECK|\\.BAD)?\\.gz$`);
const isGood = (name) => GOOD.test(name);

// ISO week like 2026-W48 (Dhaka date), for the one-per-week copy.
const isoWeek = (date = new Date()) => {
    const d = new Date(date.getTime() + 6 * 3600e3);
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() + 4 - dow);
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
    return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

// Which files to delete so only the newest `keep` remain. files: [{ name, mtimeMs }]
const toPrune = (files, keep) =>
    [...files].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(keep).map((f) => f.name);

// Orders fell below MIN_DROP_PERCENT of the last good backup?
const isBigDrop = (last, now, minDropPercent = RULES.minDropPercent) =>
    last > 0 && now * 100 < last * minDropPercent;

// ---- running the MongoDB tools ----

const run = (exe, args) =>
    new Promise((resolve) => {
        let out = "";
        const child = spawn(exe, args, { windowsHide: true });
        child.stdout.on("data", (d) => { out += d; });
        child.stderr.on("data", (d) => { out += d; });
        child.on("error", (error) => resolve({ code: -1, out: `${out}${error.message}` }));
        child.on("exit", (code) => resolve({ code, out }));
    });

const tool = (toolsDir, name) => path.join(toolsDir, process.platform === "win32" ? `${name}.exe` : name);

class Backups {
    /**
     * @param {object} o
     * @param {string} o.toolsDir   folder with mongodump / mongorestore
     * @param {string} o.uri        mongodb://127.0.0.1:47117
     * @param {object} o.client     a connected MongoClient
     * @param {string} o.dir        backups folder
     * @param {string} o.photosDir  the app's photos
     * @param {string} [o.copyDir]  optional second copy (Google Drive folder, pen drive)
     * @param {function} o.log
     */
    constructor(o) {
        Object.assign(this, o);
        this.weeklyDir = path.join(this.dir, "weekly");
        this.photosCopy = path.join(this.dir, "photos");
        this.logFile = path.join(this.dir, "backup-log.txt");
        this.lastCountFile = path.join(this.dir, ".last-order-count");
        this.busy = null;
        this.timer = null;
    }

    note(line) {
        const text = `${new Date().toISOString()} ${line}`;
        this.log(`backup: ${line}`);
        try { fs.appendFileSync(this.logFile, `${text}\n`); } catch { /* the folder went away */ }
    }

    count(db, coll) {
        return this.client.db(db).collection(coll).countDocuments();
    }

    // Open the file and count its orders in a scratch database. Returns the count or throws.
    async check(file, expected) {
        await this.client.db(CHECK_DB).dropDatabase().catch(() => {});
        const r = await run(tool(this.toolsDir, "mongorestore"), [
            `--uri=${this.uri}`, `--archive=${file}`, "--gzip", "--quiet", "--drop",
            `--nsInclude=${DB}.orders`, `--nsFrom=${DB}.*`, `--nsTo=${CHECK_DB}.*`,
        ]);
        try {
            if (r.code !== 0) throw new Error(`mongorestore can't open it (${r.out.trim().split("\n").pop()})`);
            const got = await this.count(CHECK_DB, "orders");
            // New orders can arrive during the dump, so the file may hold a few more.
            if (expected !== undefined && got < expected) throw new Error(`file has ${got} orders, the database had ${expected}`);
            return got;
        } finally {
            await this.client.db(CHECK_DB).dropDatabase().catch(() => {});
        }
    }

    // One backup. suffix "" = the normal rotating kind; e.g. "-before-update-1.0.1" is kept aside.
    async take(suffix = "") {
        if (this.busy) return this.busy;
        this.busy = this._take(suffix).finally(() => { this.busy = null; });
        return this.busy;
    }

    async _take(suffix) {
        await fsp.mkdir(this.dir, { recursive: true });
        const base = `${DB}-${stamp()}${suffix}`;
        const tmp = path.join(this.dir, `.tmp-${base}.gz`);
        const orders = await this.count(DB, "orders");
        const customers = await this.count(DB, "users");

        const dump = await run(tool(this.toolsDir, "mongodump"), [`--uri=${this.uri}`, `--db=${DB}`, `--archive=${tmp}`, "--gzip", "--quiet"]);
        if (dump.code !== 0) {
            await fsp.rm(tmp, { force: true });
            this.note(`ERROR: mongodump failed; old backups kept (${dump.out.trim().split("\n").pop()})`);
            return { ok: false };
        }
        try {
            await this.check(tmp, orders);
        } catch (error) {
            const bad = path.join(this.dir, `${base}.BAD.gz`);
            await fsp.rename(tmp, bad);
            this.note(`ERROR: bad backup (${error.message}). Kept as ${path.basename(bad)}; old backups not deleted`);
            return { ok: false };
        }

        let last = 0;
        try { last = Number(await fsp.readFile(this.lastCountFile, "utf8")) || 0; } catch { /* first backup */ }
        if (!suffix && isBigDrop(last, orders)) {
            const check = path.join(this.dir, `${base}.CHECK.gz`);
            await fsp.rename(tmp, check);
            this.note(`WARNING: orders fell from ${last} to ${orders}. Kept as ${path.basename(check)}; old backups not deleted`);
            await this.pruneMatching(/\.CHECK\.gz$/, RULES.keep);
            return { ok: false, check: true };
        }

        const final = path.join(this.dir, `${base}.gz`);
        await fsp.rename(tmp, final);
        const size = (await fsp.stat(final)).size;
        this.note(`OK: ${path.basename(final)} (${(size / 1048576).toFixed(1)} MB, customers ${customers}, orders ${orders})`);
        await this.copyPhotos(this.photosCopy);
        if (!suffix) {
            await fsp.writeFile(this.lastCountFile, String(orders));
            await this.weekly(final);
            await this.pruneMatching(GOOD, RULES.keep);
        }
        await this.secondCopy(final);
        return { ok: true, file: final, orders, customers };
    }

    // Photos never change: copy only new ones, never delete any.
    async copyPhotos(to) {
        let names;
        try { names = await fsp.readdir(this.photosDir); } catch { return 0; }
        await fsp.mkdir(to, { recursive: true });
        const have = new Set(await fsp.readdir(to));
        let n = 0;
        let failed = 0;
        for (const name of names) {
            if (have.has(name)) continue;
            try {
                await fsp.copyFile(path.join(this.photosDir, name), path.join(to, name));
                n += 1;
            } catch {
                failed += 1;
            }
        }
        if (n) this.note(`OK: ${n} new photo(s) copied to ${to}`);
        if (failed) this.note(`WARNING: ${failed} photo(s) could not be copied to ${to}`);
        return n;
    }

    // The first good backup of each week also goes to weekly/ (kept for 8 weeks).
    async weekly(file) {
        await fsp.mkdir(this.weeklyDir, { recursive: true });
        const week = isoWeek();
        const names = await fsp.readdir(this.weeklyDir);
        if (!names.some((n) => n.startsWith(`${DB}-week-${week}-`))) {
            await fsp.copyFile(file, path.join(this.weeklyDir, `${DB}-week-${week}-${path.basename(file).slice(DB.length + 1)}`));
            this.note(`OK: weekly copy kept (${week})`);
        }
        const weekly = await this.list(this.weeklyDir, new RegExp(`^${DB}-week-.*\\.gz$`));
        for (const old of toPrune(weekly, RULES.keepWeekly)) {
            await fsp.rm(path.join(this.weeklyDir, old), { force: true });
            this.note(`deleted (old weekly): ${old}`);
        }
    }

    // Only right after a good backup. Never touches .BAD / before-update / before-restore files.
    async pruneMatching(re, keep) {
        const files = await this.list(this.dir, re);
        for (const old of toPrune(files, keep)) {
            await fsp.rm(path.join(this.dir, old), { force: true });
            this.note(`deleted (old): ${old}`);
        }
    }

    async list(dir, re) {
        const out = [];
        for (const name of await fsp.readdir(dir).catch(() => [])) {
            if (!re.test(name)) continue;
            const st = await fsp.stat(path.join(dir, name)).catch(() => null);
            if (st && st.isFile()) out.push({ name, mtimeMs: st.mtimeMs });
        }
        return out;
    }

    // Optional: the newest good backup and new photos also go to a second place.
    async secondCopy(file) {
        if (!this.copyDir) return;
        try {
            await fsp.mkdir(this.copyDir, { recursive: true });
            await fsp.copyFile(file, path.join(this.copyDir, path.basename(file)));
            await this.copyPhotos(path.join(this.copyDir, "photos"));
            const there = await this.list(this.copyDir, GOOD);
            for (const old of toPrune(there, RULES.keep)) await fsp.rm(path.join(this.copyDir, old), { force: true });
            this.note(`OK: second copy in ${this.copyDir}`);
        } catch (error) {
            this.note(`WARNING: second copy to ${this.copyDir} failed (${error.message})`);
        }
    }

    // Minutes since the last attempt of any kind, so a failing backup is retried at the normal pace.
    async minutesSinceLast() {
        const files = await this.list(this.dir, ANY_ATTEMPT);
        if (!files.length) return Infinity;
        return (Date.now() - Math.max(...files.map((f) => f.mtimeMs))) / 60000;
    }

    async tick() {
        try {
            if ((await this.minutesSinceLast()) >= RULES.everyMinutes) await this.take("");
        } catch (error) {
            this.note(`ERROR: ${error.message}`);
        }
    }

    // At start (if the newest is older than 6 hours), then checked every 5 minutes.
    start() {
        fs.mkdirSync(this.dir, { recursive: true });
        for (const name of fs.readdirSync(this.dir)) {
            if (name.startsWith(".tmp-")) fs.rmSync(path.join(this.dir, name), { force: true });
        }
        this.note(`backups on: every ${RULES.everyMinutes} minutes, keep ${RULES.keep} + ${RULES.keepWeekly} weekly`);
        this.tick();
        this.timer = setInterval(() => this.tick(), RULES.checkEverySeconds * 1000);
    }

    async stop() {
        clearInterval(this.timer);
        if (this.busy) await this.busy.catch(() => {});
    }
}

module.exports = { Backups, stamp, isoWeek, toPrune, isBigDrop, isGood, run, tool, DB, RULES };

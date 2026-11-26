// Bring data over from the Docker app, or restore the app's own backup onto a new PC (Plan 22).
// Only into an empty app: data is never overwritten.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { run, tool, DB } = require("./backup");

// Not brought over: how far the old PC had synced. The new app starts its own sync from zero,
// so everything reaches the (maybe new) website again. Sending twice is harmless (saved by id).
const NOT_BROUGHT = ["syncstates"];

const restoreArgs = (uri, file) => [
    `--uri=${uri}`, `--archive=${file}`, "--gzip", "--drop", `--nsInclude=${DB}.*`,
    ...NOT_BROUGHT.map((c) => `--nsExclude=${DB}.${c}`),
];

// Collections that make an app "not empty".
const OWN_DATA = ["orders", "users", "staffs"];

const isEmpty = async (client) => {
    for (const coll of OWN_DATA) {
        if ((await client.db(DB).collection(coll).countDocuments({}, { limit: 1 })) > 0) return false;
    }
    return true;
};

// mongorestore says, per collection: "finished restoring goldhallmark.orders (29854 documents, 0 failures)"
const parseRestore = (out) => {
    const counts = {};
    let failures = 0;
    const re = new RegExp(`finished restoring ${DB}\\.([^\\s]+) \\((\\d+) documents?, (\\d+) failures?\\)`, "g");
    for (const m of out.matchAll(re)) {
        counts[m[1]] = Number(m[2]);
        failures += Number(m[3]);
    }
    const total = out.match(/(\d+) document\(s\) restored successfully and (\d+) document\(s\) failed to restore/);
    return { counts, failures: total ? Number(total[2]) : failures, restored: total ? Number(total[1]) : null };
};

// "/uploads/order-123.jpg" -> "order-123.jpg"; anything else -> null.
const photoName = (image) => {
    if (typeof image !== "string") return null;
    const m = image.match(/^\/uploads\/([^/\\]+)$/);
    return m ? m[1] : null;
};

// The report shown on screen and saved to logs/. Pure, so it can be tested.
const importReport = ({ file, fileCounts, appCounts, referenced, present, copied, failures, at = new Date() }) => {
    const names = [...new Set([...Object.keys(fileCounts), ...Object.keys(appCounts)])].sort();
    const rows = names.map((n) => ({ name: n, file: fileCounts[n] ?? 0, app: appCounts[n] ?? 0 }));
    const mismatched = rows.filter((r) => r.file !== r.app);
    const missing = [...referenced].filter((p) => !present.has(p)).sort();
    const ok = failures === 0 && mismatched.length === 0;
    const lines = [
        `Brought over from: ${file}`,
        `At: ${at.toISOString()}`,
        "",
        "Collection            In the file   In the app",
        ...rows.map((r) => `${r.name.padEnd(22)}${String(r.file).padStart(11)}${String(r.app).padStart(13)}${r.file === r.app ? "" : "   <- NOT EQUAL"}`),
        "",
        `Photos copied: ${copied}`,
        `Orders and customers with a photo: ${referenced.size}; photo file missing: ${missing.length}`,
        ...missing.slice(0, 50).map((m) => `  missing: ${m}`),
        ...(missing.length > 50 ? [`  ... and ${missing.length - 50} more`] : []),
        "",
        ok ? (missing.length ? "RESULT: all data brought over, but some photos are missing (see above)." : "RESULT: everything brought over, all counts equal.")
            : `RESULT: PROBLEM. ${failures} document(s) failed; ${mismatched.length} collection(s) not equal.`,
    ];
    return { ok, rows, missing, text: lines.join("\n") };
};

/**
 * @param {object} o
 * @param {string} o.file        the backup (.gz)
 * @param {string} [o.photosFrom] photos folder; default: "photos" next to the file
 * @param {object} o.client      connected MongoClient
 * @param {string} o.uri
 * @param {string} o.toolsDir
 * @param {string} o.photosDir   the app's photos
 * @param {string} o.logsDir
 * @param {function} o.stopServer  async
 * @param {function} o.startServer async
 * @param {function} o.log
 */
async function importBackup(o) {
    const { file, client, uri, toolsDir, photosDir, logsDir, log } = o;
    if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
    if (!(await isEmpty(client))) {
        throw new Error("This app already has data (orders, customers or staff). Bringing data over works only into an empty app, so nothing is overwritten.");
    }
    const photosFrom = o.photosFrom || path.join(path.dirname(file), "photos");

    log(`import: from ${file}`);
    await o.stopServer();
    let restore;
    try {
        restore = await run(tool(toolsDir, "mongorestore"), restoreArgs(uri, file));
    } catch (error) {
        await o.startServer();
        throw error;
    }
    const parsed = parseRestore(restore.out);
    if (restore.code !== 0) {
        await o.startServer();
        throw new Error(`The file could not be read (${restore.out.trim().split("\n").pop()})`);
    }

    // Photos: copy every file that isn't there yet.
    await fsp.mkdir(photosDir, { recursive: true });
    let copied = 0;
    const have = new Set(await fsp.readdir(photosDir));
    for (const name of await fsp.readdir(photosFrom).catch(() => [])) {
        if (have.has(name)) continue;
        const src = path.join(photosFrom, name);
        const st = await fsp.stat(src).catch(() => null);
        if (!st || !st.isFile()) continue;
        await fsp.copyFile(src, path.join(photosDir, name));
        copied += 1;
    }

    // Count what is in the app now, and which photos are pointed to.
    const appCounts = {};
    for (const coll of Object.keys(parsed.counts)) {
        appCounts[coll] = await client.db(DB).collection(coll).countDocuments();
    }
    const referenced = new Set();
    for (const coll of ["orders", "users"]) {
        const cursor = client.db(DB).collection(coll).find({ image: { $type: "string" } }, { projection: { image: 1 } });
        for await (const doc of cursor) {
            const name = photoName(doc.image);
            if (name) referenced.add(name);
        }
    }
    const present = new Set(await fsp.readdir(photosDir));
    const report = importReport({ file, fileCounts: parsed.counts, appCounts, referenced, present, copied, failures: parsed.failures });

    const stampName = new Date().toISOString().replace(/[:.]/g, "-");
    const reportFile = path.join(logsDir, `import-${stampName}.txt`);
    await fsp.writeFile(reportFile, `${report.text}\n`);
    log(`import: ${report.ok ? "done" : "PROBLEM"}; report in ${reportFile}`);

    // The server's start-up steps (memo counter, report links, purity, shops) now run on the new data.
    await o.startServer();
    return { ...report, reportFile };
}

module.exports = { importBackup, restoreArgs, isEmpty, parseRestore, importReport, photoName };

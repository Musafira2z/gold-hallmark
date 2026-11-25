// Updates (Plan 22): found on our website, downloaded quietly, installed when the app closes.
// An update is installed only if it carries our own signature (Ed25519), so a hacked website
// can't push a fake app to the shop.
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// The public half of our signing key. The private half stays on the test server, never in git.
const { UPDATE_PUBLIC_KEY } = require("./update-key");

// What is signed: the app name, the version, and the installer's SHA-512.
const message = (version, sha512) => Buffer.from(`sylhet-gold-hallmark-update\n${version}\n${sha512}\n`);

const sha512File = (file) =>
    new Promise((resolve, reject) => {
        const h = crypto.createHash("sha512");
        fs.createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("base64"))).on("error", reject);
    });

// sig: { version, sha512, signature } (the .sig file next to the installer). Returns { ok, why }.
async function verifyInstaller(file, sig, publicKeyPem = UPDATE_PUBLIC_KEY, expectedVersion) {
    if (!sig || typeof sig.signature !== "string" || typeof sig.sha512 !== "string" || typeof sig.version !== "string") {
        return { ok: false, why: "no signature" };
    }
    if (expectedVersion && sig.version !== expectedVersion) return { ok: false, why: `signature is for ${sig.version}, not ${expectedVersion}` };
    const actual = await sha512File(file);
    if (actual !== sig.sha512) return { ok: false, why: "the file is not the one that was signed" };
    let good = false;
    try {
        good = crypto.verify(null, message(sig.version, sig.sha512), publicKeyPem, Buffer.from(sig.signature, "base64"));
    } catch {
        good = false;
    }
    return good ? { ok: true } : { ok: false, why: "the signature is not ours" };
}

// Used by sign-update.js on the test server.
const signInstaller = async (file, version, privateKeyPem) => {
    const sha512 = await sha512File(file);
    const signature = crypto.sign(null, message(version, sha512), privateKeyPem).toString("base64");
    return { version, sha512, signature };
};

/**
 * Starts checking for updates.
 * @param {object} o
 * @param {object} o.updater      electron-updater's autoUpdater (or NsisUpdater)
 * @param {string} o.url          e.g. https://sylhethallmark.com/desktop/
 * @param {function} o.log
 * @param {function} o.beforeReady async; the backup taken before an update is accepted
 * @param {function} o.onReady    (version) => void
 * @param {string} [o.publicKey]
 * @param {function} [o.fetchSig] (url) => sig object; default uses fetch
 */
function startUpdates(o) {
    const { updater, url, log } = o;
    const base = url.endsWith("/") ? url : `${url}/`;
    const state = { ready: null, refused: [] };
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false; // only after our own check
    updater.disableWebInstaller = true;
    updater.disableDifferentialDownload = true; // whole file: our website serves files simply, and the signature covers the whole file
    updater.logger = { info: () => {}, warn: (m) => log(`update: ${m}`), error: (m) => log(`update: ${m}`), debug: () => {} };
    updater.setFeedURL({ provider: "generic", url: base });

    const fetchSig = o.fetchSig || (async (sigUrl) => {
        const res = await fetch(sigUrl, { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
    });

    updater.on("update-available", (info) => log(`update: ${info.version} found, downloading`));
    updater.on("error", (error) => log(`update: check failed (${error.message.split("\n")[0]})`));
    updater.on("update-downloaded", async (info) => {
        const file = info.downloadedFile;
        try {
            const sig = await fetchSig(`${base}${encodeURIComponent(path.basename(info.path || file))}.sig`).catch(() => null);
            const result = await verifyInstaller(file, sig, o.publicKey || UPDATE_PUBLIC_KEY, info.version);
            if (!result.ok) {
                state.refused.push(info.version);
                log(`update: ${info.version} REFUSED (${result.why}); not installed`);
                await fsp.rm(file, { force: true });
                return;
            }
            await o.beforeReady(info.version);
            state.ready = info.version;
            log(`update: ${info.version} checked and ready; installs when the app closes`);
            if (o.onReady) o.onReady(info.version);
        } catch (error) {
            log(`update: ${info.version} not accepted (${error.message})`);
        }
    });

    const check = () => updater.checkForUpdates().catch((error) => log(`update: check failed (${error.message.split("\n")[0]})`));
    const first = setTimeout(check, o.firstCheckMs ?? 60000);
    const every = setInterval(check, o.everyMs ?? 6 * 3600e3);
    return {
        state,
        check,
        stop() { clearTimeout(first); clearInterval(every); },
        // Called after the database is shut down. Returns true if the installer was started.
        installIfReady() {
            if (!state.ready) return false;
            log(`update: installing ${state.ready}`);
            updater.quitAndInstall(true, true);
            return true;
        },
    };
}

module.exports = { verifyInstaller, signInstaller, sha512File, startUpdates, message };

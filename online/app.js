// The online mirror (Plan 14 / S1). Data only comes in from the shop PC (sync);
// nothing here can change the shop's data.
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const Report = require("./models/Report");
const Account = require("./models/Account");
const Payment = require("./models/Payment");
const { mountPortal } = require("./portal");
const { mountOwner } = require("./owner");
const Owner = require("./models/Owner");
const Heartbeat = require("./models/Heartbeat");
const { reportPage, notFoundPage, lookupPage } = require("./views/pages");

const TOKEN_RE = /^[A-Za-z0-9]{12}$/;
const CODE_RE = /^[A-Z0-9]{4}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/;
const MAX_BATCH = 500;
const STATUSES = ["received", "ready", "delivered"];
const PURITIES = ["24K", "22K", "21K", "18K", "14K", "925"];
const KINDS = ["shop_owner", "karigor", "other"];
const CUSTOMER_RE = /^\d{1,10}$/;

// Compare secrets without leaking their length or content through timing.
const sameSecret = (a, b) => {
    const ha = crypto.createHash("sha256").update(String(a)).digest();
    const hb = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
};

// Wrong memo+code guesses: 10 per 15 minutes per address, then blocked for the rest of the window.
const createGuessLimiter = ({ max = 10, windowMs = 15 * 60 * 1000 } = {}) => {
    const hits = new Map();
    const entry = (key, now) => {
        let e = hits.get(key);
        if (!e || e.resetAt <= now) {
            e = { count: 0, resetAt: now + windowMs };
            hits.set(key, e);
        }
        if (hits.size > 10000) {
            for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        }
        return e;
    };
    return {
        blocked: (key, now = Date.now()) => entry(key, now).count >= max,
        fail: (key, now = Date.now()) => { entry(key, now).count += 1; },
    };
};

const toDate = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};
const toNum = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

// Check one order from the shop. Returns the document to save, or null if it is not valid.
const cleanIncoming = (o) => {
    if (!o || typeof o !== "object") return null;
    if (!OBJECT_ID_RE.test(String(o.id)) || !TOKEN_RE.test(String(o.reportToken)) || !CODE_RE.test(String(o.reportCode))) return null;
    const items = Array.isArray(o.items) ? o.items.slice(0, 200) : [];
    return {
        shopOrderId: String(o.id),
        reportToken: o.reportToken,
        reportCode: o.reportCode,
        voucher: toNum(o.voucher),
        type: text(o.type, 20),
        company: text(o.company),
        orderedAt: toDate(o.createdAt),
        shopUpdatedAt: toDate(o.updatedAt),
        editedAt: toDate(o.editedAt),
        deletedAt: toDate(o.deletedAt),
        status: STATUSES.includes(o.status) ? o.status : "delivered",
        readyAt: toDate(o.readyAt),
        items: items.map((it) => ({
            item: text(it && it.item),
            quantity: toNum(it && it.quantity),
            weight: toNum(it && it.weight),
            weightUnite: text(it && it.weightUnite, 20),
            xray: text(it && it.xray, 500),
            purity: it && PURITIES.includes(it.purity) ? it.purity : null,
            stamp: text(it && it.stamp, 40),
        })),
        // Portal only (Plan 18); never on the public page.
        customerID: CUSTOMER_RE.test(String(o.customerID)) ? String(o.customerID) : "",
        shopId: OBJECT_ID_RE.test(String(o.shopId)) ? String(o.shopId) : null,
        broughtBy: text(o.broughtBy, 100),
        total: toNum(o.total) ?? 0,
        paid: toNum(o.paid) ?? 0,
    };
};

// A customer's online login from the shop (Plan 18). pinHash null = login off.
const cleanAccount = (a) => {
    if (!a || typeof a !== "object" || !OBJECT_ID_RE.test(String(a.id)) || !CUSTOMER_RE.test(String(a.customerID))) return null;
    const hash = typeof a.pinHash === "string" && /^scrypt\$[A-Za-z0-9+/=$]{20,200}$/.test(a.pinHash) ? a.pinHash : null;
    return {
        shopUserId: String(a.id),
        customerID: String(a.customerID),
        name: text(a.name, 100),
        phone: /^01\d{9}$/.test(String(a.phone)) ? String(a.phone) : "",
        kind: KINDS.includes(a.kind) ? a.kind : "",
        pinHash: hash,
        pinSetAt: toDate(a.pinSetAt),
        shops: (Array.isArray(a.shops) ? a.shops.slice(0, 20) : [])
            .filter((s) => s && OBJECT_ID_RE.test(String(s.id)))
            .map((s) => ({ id: String(s.id), name: text(s.name, 200) })),
    };
};

// The owner's phone app login (Plan 19). codeHash null = off.
const cleanOwner = (o) => {
    if (!o || typeof o !== "object" || !OBJECT_ID_RE.test(String(o.id))) return null;
    const hash = typeof o.codeHash === "string" && /^sha256\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(o.codeHash) ? o.codeHash : null;
    return { shopStaffId: String(o.id), name: text(o.name, 100), codeHash: hash, codeSetAt: toDate(o.codeSetAt) };
};

// The PC's heartbeat (Plan 19).
const cleanHeartbeat = (b) => {
    if (!b || typeof b !== "object") return null;
    const bk = b.backup && typeof b.backup === "object" ? b.backup : null;
    const waiting = toNum(b.waiting);
    return {
        at: toDate(b.at),
        version: text(b.version, 40),
        waiting: waiting !== null && waiting >= 0 ? Math.floor(waiting) : 0,
        backup: bk && toDate(bk.at) ? { name: text(bk.name, 100), at: toDate(bk.at), size: toNum(bk.size) ?? 0 } : null,
    };
};

// A later payment from the shop (Plan 18).
const cleanPayment = (p) => {
    if (!p || typeof p !== "object" || !OBJECT_ID_RE.test(String(p.id)) || !CUSTOMER_RE.test(String(p.customerID))) return null;
    const amount = toNum(p.amount);
    if (amount === null) return null;
    return { shopPaymentId: String(p.id), customerID: String(p.customerID), amount, at: toDate(p.at), deletedAt: toDate(p.deletedAt) };
};

const securityHeaders = (_req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    next();
};

// Desktop app updates (Plan 23): only these files, from a folder outside the code.
// latest-linux.yml is only for the Linux rehearsal; the shop's Windows app reads latest.yml.
const DESKTOP_FILE_RE = /^(latest(-linux)?\.yml|[A-Za-z0-9][A-Za-z0-9._-]*\.(exe|exe\.sig|exe\.blockmap))$/;
const serveDesktop = (dir) => {
    const files = express.static(dir, { dotfiles: "deny", index: false, redirect: false, fallthrough: false });
    return (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const name = req.path.replace(/^\//, "");
        if (!DESKTOP_FILE_RE.test(name)) return res.status(404).type("text").send("Not found");
        // A new version must be seen at once; the installer itself never changes under its name.
        res.set("Cache-Control", /\.(yml|sig)$/.test(name) ? "no-store" : "public, max-age=86400");
        files(req, res, (err) => {
            if (err && err.status === 404) return res.status(404).type("text").send("Not found");
            next(err);
        });
    };
};

const ROBOTS = "User-agent: *\nDisallow: /r/\nDisallow: /report\nDisallow: /login\nDisallow: /me\nDisallow: /owner\nDisallow: /api/\nDisallow: /desktop/\n";

// Behind Hostinger's proxy: http -> https, and tell browsers to stay on https.
// Only when the proxy says the visit came over http, so a proxy that never says can't cause a loop.
const httpsOnly = (req, res, next) => {
    const said = (req.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    if (said === "https") res.set("Strict-Transport-Security", "max-age=31536000");
    if (said !== "http" || req.path === "/api/health") return next();
    if (req.method !== "GET" && req.method !== "HEAD") return res.status(403).json({ error: "Use https" });
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
};

const createApp = ({
    syncKey,
    desktopDir = null,
    httpsOnlyMode = false,
    limiter = createGuessLimiter(),
    loginIpLimiter = createGuessLimiter({ max: 20 }),
    loginPhoneLimiter = createGuessLimiter({ max: 5 }),
    ownerLimiter = createGuessLimiter({ max: 10 }),
    trustProxy = false,
} = {}) => {
    if (!syncKey || syncKey.length < 24) throw new Error("SYNC_KEY must be set (at least 24 characters).");
    const app = express();
    app.disable("x-powered-by");
    if (trustProxy) app.set("trust proxy", 1); // behind Hostinger's proxy: real visitor address
    if (httpsOnlyMode) app.use(httpsOnly);
    app.use(securityHeaders);
    app.get("/robots.txt", (_req, res) => res.type("text").send(ROBOTS));
    if (desktopDir) app.use("/desktop", serveDesktop(path.resolve(desktopDir)));

    app.get("/api/health", async (_req, res) => {
        res.json({ ok: true, reports: await Report.estimatedDocumentCount() });
    });

    // Shop PC -> here. Saving by the shop's order id makes repeats harmless.
    app.post("/api/sync/orders", express.json({ limit: "5mb" }), async (req, res) => {
        const auth = req.get("authorization") || "";
        const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!given || !sameSecret(given, syncKey)) return res.status(401).json({ error: "Wrong sync key" });
        const orders = req.body && req.body.orders;
        if (!Array.isArray(orders) || orders.length > MAX_BATCH) {
            return res.status(400).json({ error: `Send 'orders' as a list of at most ${MAX_BATCH}` });
        }
        const now = new Date();
        const docs = orders.map(cleanIncoming);
        const valid = docs.filter(Boolean);
        if (valid.length > 0) {
            await Report.bulkWrite(
                valid.map((doc) => ({
                    updateOne: { filter: { shopOrderId: doc.shopOrderId }, update: { $set: { ...doc, syncedAt: now } }, upsert: true },
                })),
                { ordered: false }
            );
        }
        res.json({ saved: valid.length, skipped: docs.length - valid.length });
    });

    // Shop PC -> here, for the portal (Plan 18). Saved by the shop's id, so repeats are harmless.
    const receive = (path, listKey, clean, Model, idField) => {
        app.post(path, express.json({ limit: "5mb" }), async (req, res) => {
            const auth = req.get("authorization") || "";
            const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
            if (!given || !sameSecret(given, syncKey)) return res.status(401).json({ error: "Wrong sync key" });
            const list = req.body && req.body[listKey];
            if (!Array.isArray(list) || list.length > MAX_BATCH) {
                return res.status(400).json({ error: `Send '${listKey}' as a list of at most ${MAX_BATCH}` });
            }
            const now = new Date();
            const docs = list.map(clean);
            const valid = docs.filter(Boolean);
            if (valid.length > 0) {
                await Model.bulkWrite(
                    valid.map((doc) => ({ updateOne: { filter: { [idField]: doc[idField] }, update: { $set: { ...doc, syncedAt: now } }, upsert: true } })),
                    { ordered: false }
                );
            }
            res.json({ saved: valid.length, skipped: docs.length - valid.length });
        });
    };
    receive("/api/sync/accounts", "accounts", cleanAccount, Account, "shopUserId");
    receive("/api/sync/payments", "payments", cleanPayment, Payment, "shopPaymentId");
    receive("/api/sync/owners", "owners", cleanOwner, Owner, "shopStaffId");

    // The PC is alive (Plan 19). One document; our clock says when we heard from it.
    app.post("/api/sync/heartbeat", express.json({ limit: "10kb" }), async (req, res) => {
        const auth = req.get("authorization") || "";
        const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!given || !sameSecret(given, syncKey)) return res.status(401).json({ error: "Wrong sync key" });
        const beat = cleanHeartbeat(req.body);
        if (!beat) return res.status(400).json({ error: "Bad heartbeat" });
        await Heartbeat.updateOne({ _id: "pc" }, { $set: { ...beat, receivedAt: new Date() } }, { upsert: true });
        res.json({ ok: true });
    });

    // Karigor / shop owner login and pages (Plan 18).
    mountPortal(app, { ipLimiter: loginIpLimiter, phoneLimiter: loginPhoneLimiter });
    // Owner's phone app (Plan 19).
    mountOwner(app, { limiter: ownerLimiter });

    // QR on the memo opens this.
    app.get("/r/:token", async (req, res) => {
        const { token } = req.params;
        const report = TOKEN_RE.test(token) ? await Report.findOne({ reportToken: token }).lean() : null;
        if (!report) return res.status(404).type("html").send(notFoundPage());
        res.set("Cache-Control", "no-store").type("html").send(reportPage(report));
    });

    // Memo number + code (both printed on the memo).
    app.get("/report", async (req, res) => {
        const memo = typeof req.query.memo === "string" ? req.query.memo.trim() : "";
        const code = typeof req.query.code === "string" ? req.query.code.replace(/\s+/g, "").toUpperCase() : "";
        if (!memo && !code) return res.type("html").send(lookupPage({}));
        const who = req.ip || "unknown";
        if (limiter.blocked(who)) {
            return res.status(429).type("html").send(lookupPage({ memo, code, error: "Too many wrong tries. Please wait 15 minutes. · অনেকবার ভুল হয়েছে, ১৫ মিনিট পরে চেষ্টা করুন।" }));
        }
        const report = /^\d{1,12}$/.test(memo) && CODE_RE.test(code)
            ? await Report.findOne({ voucher: Number(memo), reportCode: code }, { reportToken: 1 }).lean()
            : null;
        if (!report) {
            limiter.fail(who);
            return res.status(404).type("html").send(lookupPage({ memo, code, error: "No report with this memo number and code. · এই নম্বর ও কোডে রিপোর্ট নেই।" }));
        }
        res.redirect(303, `/r/${report.reportToken}`);
    });

    app.get("/", (_req, res) => res.redirect(302, "/report"));
    app.use((_req, res) => res.status(404).type("html").send(notFoundPage()));
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
        if (err.type === "entity.too.large" || err.type === "entity.parse.failed") return res.status(400).json({ error: "Bad request" });
        console.error(err);
        res.status(500).json({ error: "Server error" });
    });
    return app;
};

module.exports = { DESKTOP_FILE_RE, createApp, createGuessLimiter, cleanIncoming, cleanAccount, cleanPayment, cleanOwner, cleanHeartbeat };

// The online mirror (Plan 14 / S1). Data only comes in from the shop PC (sync);
// nothing here can change the shop's data.
const crypto = require("crypto");
const express = require("express");
const Report = require("./models/Report");
const { reportPage, notFoundPage, lookupPage } = require("./views/pages");

const TOKEN_RE = /^[A-Za-z0-9]{12}$/;
const CODE_RE = /^[A-Z0-9]{4}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/;
const MAX_BATCH = 500;
const STATUSES = ["received", "ready", "delivered"];
const PURITIES = ["24K", "22K", "21K", "18K", "14K", "925"];

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
    };
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

const createApp = ({ syncKey, limiter = createGuessLimiter(), trustProxy = false } = {}) => {
    if (!syncKey || syncKey.length < 24) throw new Error("SYNC_KEY must be set (at least 24 characters).");
    const app = express();
    app.disable("x-powered-by");
    if (trustProxy) app.set("trust proxy", 1); // behind Hostinger's proxy: real visitor address
    app.use(securityHeaders);

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

module.exports = { createApp, createGuessLimiter, cleanIncoming };

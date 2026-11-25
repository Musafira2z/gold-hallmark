// Karigor / shop owner portal (Plan 18): phone + PIN login, their tests, dues, monthly statement.
// Read-only: nothing here changes data; it all comes from the shop PC by the sync.
const crypto = require("crypto");
const express = require("express");
const Report = require("./models/Report");
const Account = require("./models/Account");
const Payment = require("./models/Payment");
const PortalSession = require("./models/PortalSession");
const { checkPin, loginPhone, hashPin } = require("./pin");
const views = require("./views/portal");

const COOKIE = "gh_s";
const SESSION_DAYS = 30;
const PAGE_SIZE = 30;
const DHAKA_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6 all year
const STATUSES = ["received", "ready", "delivered"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
// Checked when the phone has no account, so a wrong phone takes as long as a wrong PIN.
const DUMMY_HASH = hashPin("000000");

const readCookie = (req, name) => {
    const header = req.get("cookie") || "";
    for (const part of header.split(";")) {
        const i = part.indexOf("=");
        if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return "";
};
const setCookie = (req, res, value, maxAgeSec) => {
    const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
    if (req.secure) parts.push("Secure");
    res.set("Set-Cookie", parts.join("; "));
};

// "2026-11" -> { start, end, label } in Dhaka time. Bad or missing -> this month.
const monthRange = (text, now = new Date()) => {
    let y;
    let m;
    const match = /^(\d{4})-(\d{2})$/.exec(String(text || ""));
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12 && Number(match[1]) >= 2020 && Number(match[1]) <= 2100) {
        y = Number(match[1]);
        m = Number(match[2]);
    } else {
        const local = new Date(now.getTime() + DHAKA_MS);
        y = local.getUTCFullYear();
        m = local.getUTCMonth() + 1;
    }
    const start = new Date(Date.UTC(y, m - 1, 1) - DHAKA_MS);
    const end = new Date(Date.UTC(y, m, 1) - DHAKA_MS);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return { start, end, key, prev, next };
};

// What this account may see: their own orders, plus (shop owners) their shops' orders.
const scopeOf = (acc) => {
    const own = { customerID: acc.customerID };
    const shopIds = (acc.shops || []).map((s) => s.id);
    return shopIds.length ? { $or: [own, { shopId: { $in: shopIds } }] } : own;
};

// Dues: bills - paid at the counter - later payments; deleted ones left out (same rule as the shop app).
const balanceOf = async (customerID) => {
    const [orders, payments] = await Promise.all([
        Report.aggregate([
            { $match: { customerID, deletedAt: null } },
            { $group: { _id: null, billed: { $sum: { $ifNull: ["$total", 0] } }, paid: { $sum: { $ifNull: ["$paid", 0] } } } },
        ]),
        Payment.aggregate([
            { $match: { customerID, deletedAt: null } },
            { $group: { _id: null, paid: { $sum: "$amount" } } },
        ]),
    ]);
    const billed = round2(orders[0]?.billed);
    const paidAtOrder = round2(orders[0]?.paid);
    const paidLater = round2(payments[0]?.paid);
    return { billed, paidAtOrder, paidLater, due: round2(billed - paidAtOrder - paidLater) };
};

const mountPortal = (app, { ipLimiter, phoneLimiter }) => {
    const form = express.urlencoded({ extended: false, limit: "2kb" });

    // Who is logged in, or null. A new PIN or a turned-off login ends old sessions.
    const currentAccount = async (req) => {
        const token = readCookie(req, COOKIE);
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
        const session = await PortalSession.findOne({ _id: sha256(token), expiresAt: { $gt: new Date() } }).lean();
        if (!session) return null;
        const acc = await Account.findOne({ shopUserId: session.account, pinHash: { $type: "string" } }).lean();
        if (!acc || !acc.pinSetAt || acc.pinSetAt > session.createdAt) return null;
        return acc;
    };
    const requireLogin = async (req, res, next) => {
        try {
            const acc = await currentAccount(req);
            if (!acc) {
                if (readCookie(req, COOKIE)) setCookie(req, res, "", 0);
                return res.redirect(303, "/login");
            }
            req.account = acc;
            res.set("Cache-Control", "no-store");
            return next();
        } catch (error) {
            return next(error);
        }
    };

    app.get("/login", async (req, res, next) => {
        try {
            if (await currentAccount(req)) return res.redirect(303, "/me");
            res.set("Cache-Control", "no-store").type("html").send(views.loginPage({}));
        } catch (error) {
            next(error);
        }
    });

    app.post("/login", form, async (req, res, next) => {
        try {
            const phoneText = typeof req.body.phone === "string" ? req.body.phone.slice(0, 30) : "";
            const pin = typeof req.body.pin === "string" ? req.body.pin.trim() : "";
            const phone = loginPhone(phoneText);
            const who = req.ip || "unknown";
            const page = (status, error) => res.status(status).set("Cache-Control", "no-store").type("html")
                .send(views.loginPage({ phone: phoneText, error }));
            if (ipLimiter.blocked(who) || (phone && phoneLimiter.blocked(phone))) {
                return page(429, "Too many wrong tries. Please wait 15 minutes. · অনেকবার ভুল হয়েছে, ১৫ মিনিট পরে চেষ্টা করুন।");
            }
            const accounts = phone ? await Account.find({ phone, pinHash: { $type: "string" } }).lean() : [];
            let found = null;
            for (const acc of accounts) if (!found && checkPin(pin, acc.pinHash)) found = acc;
            if (accounts.length === 0) checkPin("000000", DUMMY_HASH);
            if (!found) {
                ipLimiter.fail(who);
                if (phone) phoneLimiter.fail(phone);
                return page(401, "Wrong phone number or PIN. · ফোন নম্বর বা পিন ভুল।");
            }
            const token = crypto.randomBytes(32).toString("base64url");
            await PortalSession.create({
                _id: sha256(token),
                account: found.shopUserId,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
            });
            setCookie(req, res, token, SESSION_DAYS * 86400);
            return res.redirect(303, "/me");
        } catch (error) {
            return next(error);
        }
    });

    app.post("/logout", async (req, res, next) => {
        try {
            const token = readCookie(req, COOKIE);
            if (token) await PortalSession.deleteOne({ _id: sha256(token) });
            setCookie(req, res, "", 0);
            res.redirect(303, "/login");
        } catch (error) {
            next(error);
        }
    });

    app.get("/me", requireLogin, async (req, res, next) => {
        try {
            const acc = req.account;
            const q = req.query;
            const filters = {
                month: typeof q.month === "string" && /^\d{4}-\d{2}$/.test(q.month) ? q.month : "",
                shop: typeof q.shop === "string" && (acc.shops || []).some((s) => s.id === q.shop) ? q.shop : "",
                status: typeof q.status === "string" && STATUSES.includes(q.status) ? q.status : "",
                memo: typeof q.memo === "string" && /^\d{1,12}$/.test(q.memo.trim()) ? q.memo.trim() : "",
            };
            const page = Math.max(1, Math.min(1000, Number.parseInt(q.page, 10) || 1));
            const scope = { $and: [scopeOf(acc), { deletedAt: null }] };
            const list = { $and: [...scope.$and] };
            if (filters.month) {
                const r = monthRange(filters.month);
                list.$and.push({ orderedAt: { $gte: r.start, $lt: r.end } });
            }
            if (filters.shop) list.$and.push({ shopId: filters.shop });
            if (filters.status) list.$and.push({ status: filters.status });
            if (filters.memo) list.$and.push({ voucher: Number(filters.memo) });
            const anyFilter = Boolean(filters.month || filters.shop || filters.status || filters.memo);
            const thisMonth = monthRange("");
            const own = { customerID: acc.customerID, deletedAt: null };

            const [total, rows, ready, balance, monthOwn, monthAll] = await Promise.all([
                Report.countDocuments(list),
                Report.find(list).sort({ orderedAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
                anyFilter || page > 1 ? [] : Report.find({ $and: [...scope.$and, { status: "ready" }] }).sort({ readyAt: -1 }).limit(20).lean(),
                balanceOf(acc.customerID),
                Report.aggregate([
                    { $match: { ...own, orderedAt: { $gte: thisMonth.start, $lt: thisMonth.end } } },
                    { $group: { _id: null, tests: { $sum: 1 }, billed: { $sum: { $ifNull: ["$total", 0] } } } },
                ]),
                (acc.shops || []).length
                    ? Report.countDocuments({ ...scope, orderedAt: { $gte: thisMonth.start, $lt: thisMonth.end } })
                    : null,
            ]);
            res.type("html").send(views.mePage({
                acc,
                filters,
                page,
                pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
                total,
                rows,
                ready,
                balance,
                month: { key: thisMonth.key, tests: monthOwn[0]?.tests || 0, billed: round2(monthOwn[0]?.billed), all: monthAll },
            }));
        } catch (error) {
            next(error);
        }
    });

    app.get("/me/statement", requireLogin, async (req, res, next) => {
        try {
            const acc = req.account;
            const range = monthRange(req.query.month);
            const own = { customerID: acc.customerID, deletedAt: null, orderedAt: { $gte: range.start, $lt: range.end } };
            const [orders, payments, balance] = await Promise.all([
                Report.find(own).sort({ orderedAt: 1, _id: 1 }).limit(2000).lean(),
                Payment.find({ customerID: acc.customerID, deletedAt: null, at: { $gte: range.start, $lt: range.end } }).sort({ at: 1 }).lean(),
                balanceOf(acc.customerID),
            ]);
            const sum = (list, f) => round2(list.reduce((a, x) => a + (Number(f(x)) || 0), 0));
            res.type("html").send(views.statementPage({
                acc,
                range,
                orders,
                payments,
                totals: {
                    tests: orders.length,
                    pieces: sum(orders, (o) => (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0)),
                    billed: sum(orders, (o) => o.total),
                    paidAtOrder: sum(orders, (o) => o.paid),
                    paidLater: sum(payments, (p) => p.amount),
                },
                balance,
            }));
        } catch (error) {
            next(error);
        }
    });
};

module.exports = { mountPortal, monthRange, scopeOf, balanceOf, readCookie };

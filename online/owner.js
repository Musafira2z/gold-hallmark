// Owner's phone app (Plan 19): code login, one dashboard page, installable (PWA).
// Read-only, like everything on the website.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Owner = require("./models/Owner");
const Heartbeat = require("./models/Heartbeat");
const PortalSession = require("./models/PortalSession");
const { checkCode, hashCode } = require("./ownerCode");
const { readCookie } = require("./portal");
const { ownerStats, health } = require("./ownerStats");
const views = require("./views/owner");

const COOKIE = "gh_o";
const SESSION_DAYS = 90;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const DUMMY = hashCode("AAAA-AAAA-AAAA"); // a wrong code with no owner takes as long as any other
const PUBLIC = path.join(__dirname, "public");
const FILES = {
    "icon-192.png": "image/png",
    "icon-512.png": "image/png",
    "icon.svg": "image/svg+xml",
    "app.js": "text/javascript; charset=utf-8",
};

// Pages under /owner may load scripts from this site (service worker, its small starter).
const OWNER_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

const mountOwner = (app, { limiter }) => {
    const router = express.Router();
    const form = express.urlencoded({ extended: false, limit: "1kb" });
    router.use((_req, res, next) => {
        res.set("Content-Security-Policy", OWNER_CSP);
        next();
    });

    const setCookie = (req, res, value, maxAgeSec) => {
        const parts = [`${COOKIE}=${value}`, "Path=/owner", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
        if (req.secure) parts.push("Secure");
        res.set("Set-Cookie", parts.join("; "));
    };
    const currentOwner = async (req) => {
        const token = readCookie(req, COOKIE);
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
        const session = await PortalSession.findOne({ _id: sha256(token), expiresAt: { $gt: new Date() } }).lean();
        if (!session || !session.account.startsWith("owner:")) return null;
        const owner = await Owner.findOne({ shopStaffId: session.account.slice(6), codeHash: { $type: "string" } }).lean();
        if (!owner || !owner.codeSetAt || owner.codeSetAt > session.createdAt) return null;
        return owner;
    };

    // PWA files. No caching of business data anywhere.
    router.get("/manifest.webmanifest", (_req, res) => {
        res.type("application/manifest+json").set("Cache-Control", "public, max-age=3600").send(JSON.stringify(views.manifest));
    });
    router.get("/sw.js", (_req, res) => {
        res.type("text/javascript; charset=utf-8").set({ "Cache-Control": "no-cache", "Service-Worker-Allowed": "/owner/" })
            .send(fs.readFileSync(path.join(PUBLIC, "sw.js")));
    });
    router.get("/offline", (_req, res) => res.type("html").send(views.offlinePage()));
    router.get("/:file", (req, res, next) => {
        const type = FILES[req.params.file];
        if (!type) return next();
        res.type(type).set("Cache-Control", "public, max-age=86400").send(fs.readFileSync(path.join(PUBLIC, req.params.file)));
    });

    router.get("/login", async (req, res, next) => {
        try {
            if (await currentOwner(req)) return res.redirect(303, "/owner");
            res.set("Cache-Control", "no-store").type("html").send(views.loginPage({}));
        } catch (error) {
            next(error);
        }
    });

    router.post("/login", form, async (req, res, next) => {
        try {
            const code = typeof req.body.code === "string" ? req.body.code.slice(0, 40) : "";
            const who = req.ip || "unknown";
            const page = (status, error) => res.status(status).set("Cache-Control", "no-store").type("html").send(views.loginPage({ error }));
            if (limiter.blocked(who)) return page(429, "Too many wrong tries. Please wait 15 minutes. · ১৫ মিনিট পরে চেষ্টা করুন।");
            const owners = await Owner.find({ codeHash: { $type: "string" } }).lean();
            let found = null;
            for (const o of owners) if (!found && checkCode(code, o.codeHash)) found = o;
            if (owners.length === 0) checkCode("AAAA-AAAA-AAAA", DUMMY);
            if (!found) {
                limiter.fail(who);
                return page(401, "Wrong code. · কোড ভুল।");
            }
            const token = crypto.randomBytes(32).toString("base64url");
            await PortalSession.create({
                _id: sha256(token),
                account: `owner:${found.shopStaffId}`,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
            });
            setCookie(req, res, token, SESSION_DAYS * 86400);
            return res.redirect(303, "/owner");
        } catch (error) {
            return next(error);
        }
    });

    router.post("/logout", async (req, res, next) => {
        try {
            const token = readCookie(req, COOKIE);
            if (token) await PortalSession.deleteOne({ _id: sha256(token) });
            setCookie(req, res, "", 0);
            res.redirect(303, "/owner/login");
        } catch (error) {
            next(error);
        }
    });

    router.get("/", async (req, res, next) => {
        try {
            const owner = await currentOwner(req);
            if (!owner) {
                if (readCookie(req, COOKIE)) setCookie(req, res, "", 0);
                return res.redirect(303, "/owner/login");
            }
            const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : "";
            const now = new Date();
            const [stats, beat] = await Promise.all([ownerStats({ now, month }), Heartbeat.findById("pc").lean()]);
            res.set("Cache-Control", "no-store").type("html").send(views.dashboardPage({ owner, stats, beat, health: health(beat, now) }));
        } catch (error) {
            next(error);
        }
    });

    app.use("/owner", router); // also answers "/owner" itself
};

module.exports = { mountOwner, OWNER_CSP };

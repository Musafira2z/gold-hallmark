// Plan 19: owner's phone app. Run: npm test (needs MONGO_URI; uses its own "<db>_owner" database).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const Report = require("../models/Report");
const Payment = require("../models/Payment");
const Owner = require("../models/Owner");
const Heartbeat = require("../models/Heartbeat");
const PortalSession = require("../models/PortalSession");
const { createApp, createGuessLimiter, cleanHeartbeat } = require("../app");
const { hashCode } = require("../ownerCode");
const { ownerStats, health } = require("../ownerStats");

const KEY = "test-key-0123456789abcdefghij";
const CODE = "K7PQ-M2XD-9HTW";
let server;
let base;
const hex = (n) => n.toString(16).padStart(24, "0");
// Wed 25 Nov 2026, 14:00 in Dhaka
const NOW = new Date("2026-11-25T08:00:00Z");

const rep = (n, at, extra = {}) => ({
    shopOrderId: hex(n), reportToken: `Own${String(n).padStart(9, "0")}`, reportCode: "AB3D", voucher: 3000000 + n,
    type: "hallmark", company: "MAA JEWELLERS", shopId: hex(900), orderedAt: new Date(at), status: "delivered",
    items: [{ item: "Ring", quantity: 1, purity: "22K" }], customerID: "1", broughtBy: "KARIM", total: 0, paid: 0, ...extra,
});
const post = (path, body, key = KEY) => fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
});
const login = (code) => fetch(`${base}/owner/login`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code }).toString(), redirect: "manual",
});
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];
const get = (path, cookie) => fetch(`${base}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

before(async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI needed");
    await mongoose.connect(process.env.MONGO_URI.replace(/\/([^/?]+)(\?|$)/, "/$1_owner$2"));
    await Promise.all([Report, Payment, Owner, Heartbeat, PortalSession].map((m) => m.deleteMany({})));
    await Promise.all([Report, Payment, Owner, PortalSession].map((m) => m.syncIndexes()));
    await Report.insertMany([
        rep(1, "2026-11-25T03:00:00Z", { total: 100, paid: 100, items: [{ item: "Ring", quantity: 2, purity: "22K" }] }),
        rep(2, "2026-11-25T07:00:00Z", { customerID: "2", broughtBy: "RAHIM", total: 50, paid: 0, type: "xray", status: "ready", items: [{ item: "Chain", quantity: 1, purity: "21K" }] }),
        rep(3, "2026-11-24T18:30:00Z", { total: 40, paid: 40 }),             // 00:30 25 Nov in Dhaka: today
        rep(4, "2026-11-24T17:30:00Z", { customerID: "2", broughtBy: "RAHIM", total: 40, paid: 0 }), // 23:30 24 Nov: yesterday
        rep(5, "2026-11-18T05:00:00Z", { total: 70, paid: 70 }),             // last Wednesday, before 14:00
        rep(6, "2026-11-18T09:00:00Z", { total: 1000, paid: 1000 }),         // last Wednesday, after 14:00
        rep(7, "2026-11-25T04:00:00Z", { total: 999, paid: 0, deletedAt: new Date("2026-11-25T05:00:00Z") }),
        rep(8, "2026-10-10T05:00:00Z", { customerID: "3", broughtBy: "SALAM", total: 200, paid: 200 }),
        rep(9, "2026-10-28T05:00:00Z", { customerID: "3", broughtBy: "SALAM", total: 300, paid: 0 }),
    ]);
    await Payment.insertMany([
        { shopPaymentId: hex(501), customerID: "2", amount: 20, at: new Date("2026-11-25T05:00:00Z") },
        { shopPaymentId: hex(502), customerID: "3", amount: 300, at: new Date("2026-11-25T05:00:00Z"), deletedAt: new Date() },
    ]);
    const app = createApp({ syncKey: KEY, ownerLimiter: createGuessLimiter({ max: 4 }) });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server.close();
    await mongoose.disconnect();
});

test("numbers: today, last week by this time, month to date, dues, tops", async () => {
    const s = await ownerStats({ now: NOW });
    assert.deepStrictEqual(
        { orders: s.today.orders, pieces: s.today.pieces, billed: s.today.billed, paidAtOrder: s.today.paidAtOrder, paidLater: s.today.paidLater, cash: s.today.cash },
        { orders: 3, pieces: 4, billed: 190, paidAtOrder: 140, paidLater: 20, cash: 160 }
    );
    assert.strictEqual(s.lastWeek.billed, 70, "only last Wednesday before 14:00");
    assert.strictEqual(s.month.key, "2026-11");
    assert.strictEqual(s.month.orders, 6);
    assert.strictEqual(s.month.billed, 1300);
    assert.strictEqual(s.prevMonth.billed, 200, "October up to the same point (not the 28th)");
    assert.deepStrictEqual({ total: s.dues.total, customers: s.dues.customers }, { total: 370, customers: 2 });
    assert.deepStrictEqual(s.dues.top.map((d) => [d.customerID, d.due, d.name]), [["3", 300, "SALAM"], ["2", 70, "RAHIM"]]);
    assert.deepStrictEqual(s.waiting, { received: 0, ready: 1 });
    assert.deepStrictEqual(s.topCustomers.map((c) => [c.name, c.orders, c.billed]), [["KARIM", 4, 1210], ["RAHIM", 2, 90]]);
    assert.deepStrictEqual(s.topShops.map((x) => [x.name, x.orders]), [["MAA JEWELLERS", 6]]);
    assert.deepStrictEqual(s.purity, [{ purity: "22K", pieces: 6 }, { purity: "21K", pieces: 1 }]);
    assert.strictEqual(s.last30.length, 30);
    assert.deepStrictEqual(s.last30[29], { day: "2026-11-25", orders: 3, billed: 190 });
    assert.deepStrictEqual(s.last30[28], { day: "2026-11-24", orders: 1, billed: 40 });
    assert.strictEqual(s.latest[0].voucher, 3000002);
    const oct = await ownerStats({ now: NOW, month: "2026-10" });
    assert.strictEqual(oct.month.isCurrent, false);
    assert.strictEqual(oct.month.billed, 500, "a past month counts in full");
});

test("PC health colours", () => {
    const now = new Date("2026-11-25T08:00:00Z");
    const beat = (minAgo, backupH) => ({ receivedAt: new Date(now - minAgo * 60000), backup: backupH === null ? null : { at: new Date(now - backupH * 3600000) } });
    assert.deepStrictEqual([health(beat(2, 5), now).pc, health(beat(2, 5), now).backup], ["green", "green"]);
    assert.deepStrictEqual([health(beat(30, 30), now).pc, health(beat(30, 30), now).backup], ["amber", "amber"]);
    assert.deepStrictEqual([health(beat(300, 100), now).pc, health(beat(300, 100), now).backup], ["red", "red"]);
    assert.strictEqual(health(beat(1, null), now).backup, "red");
    assert.strictEqual(health(null, now).pc, "red");
    assert.strictEqual(cleanHeartbeat({ waiting: -5, backup: { at: "nope" } }).backup, null);
    assert.strictEqual(cleanHeartbeat({ waiting: -5 }).waiting, 0);
});

test("owners and heartbeat need the sync key", async () => {
    assert.strictEqual((await post("/api/sync/owners", { owners: [] }, "nope")).status, 401);
    assert.strictEqual((await post("/api/sync/heartbeat", {}, "nope")).status, 401);
    const r = await post("/api/sync/owners", { owners: [
        { id: hex(77), name: "Owner", codeHash: hashCode(CODE), codeSetAt: "2026-11-01T00:00:00Z" },
        { id: hex(78), name: "Plain", codeHash: "K7PQM2XD9HTW" },
        { id: "bad" },
    ] });
    assert.deepStrictEqual(await r.json(), { saved: 2, skipped: 1 });
    assert.strictEqual((await Owner.findOne({ name: "Plain" }).lean()).codeHash, null, "a non-hash is never stored");
    const b = await post("/api/sync/heartbeat", { at: "2026-11-25T07:59:00Z", version: "abc1234", waiting: 2, backup: { name: "x.gz", at: "2026-11-25T02:00:00Z", size: 1234 } });
    assert.strictEqual(b.status, 200);
    const beat = await Heartbeat.findById("pc").lean();
    assert.strictEqual(beat.version, "abc1234");
    assert.ok(Date.now() - beat.receivedAt < 60000);
});

test("login with the code; dashboard; logout", async () => {
    const none = await get("/owner");
    assert.strictEqual(none.status, 303);
    assert.strictEqual(none.headers.get("location"), "/owner/login");
    const lp = await get("/owner/login");
    assert.match(lp.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(await lp.text(), /rel="manifest"/);
    assert.strictEqual((await login("K7PQ-M2XD-9HTX")).status, 401);
    const ok = await login("k7pq m2xd 9htw");
    assert.strictEqual(ok.status, 303);
    assert.match(ok.headers.get("set-cookie"), /^gh_o=[A-Za-z0-9_-]{43}; Path=\/owner; HttpOnly; SameSite=Lax; Max-Age=7776000$/);
    const c = cookieOf(ok);
    const page = await get("/owner", c);
    assert.strictEqual(page.status, 200);
    assert.strictEqual(page.headers.get("cache-control"), "no-store");
    const html = await page.text();
    assert.match(html, /Bill today/);
    assert.match(html, /Shop PC seen/);
    assert.match(html, /version abc1234/);
    assert.match(html, /<svg viewBox="0 0 600 150" role="img"/);
    assert.match(html, /SALAM/);
    assert.match((await (await get("/owner?month=2026-10", c)).text()), /October 2026/);
    const out = await fetch(`${base}/owner/logout`, { method: "POST", headers: { cookie: c }, redirect: "manual" });
    assert.strictEqual(out.status, 303);
    assert.strictEqual((await get("/owner", c)).status, 303);
});

test("a portal session can't open the owner page, and a new code logs phones out", async () => {
    const c = cookieOf(await login(CODE));
    assert.strictEqual((await get("/owner", c)).status, 200);
    const portalCookie = c.replace("gh_o=", "gh_s=");
    assert.strictEqual((await get("/me", portalCookie)).status, 303, "owner session is not a portal login");
    await Owner.updateOne({ shopStaffId: hex(77) }, { $set: { codeSetAt: new Date(Date.now() + 1000), codeHash: hashCode("AAAA-BBBB-CCCC") } });
    assert.strictEqual((await get("/owner", c)).status, 303, "new code ends old sessions");
    assert.strictEqual((await login(CODE)).status, 401, "old code no longer works");
    await Owner.updateOne({ shopStaffId: hex(77) }, { $set: { codeSetAt: new Date(Date.now() - 1000) } });
    const c2 = cookieOf(await login("AAAA-BBBB-CCCC"));
    assert.strictEqual((await get("/owner", c2)).status, 200);
    await Owner.updateOne({ shopStaffId: hex(77) }, { $set: { codeHash: null } });
    assert.strictEqual((await get("/owner", c2)).status, 303, "turned off");
});

test("too many wrong codes block the address", async () => {
    for (let i = 0; i < 4; i += 1) await login("ZZZZ-ZZZZ-ZZZZ");
    assert.strictEqual((await login("ZZZZ-ZZZZ-ZZZZ")).status, 429);
});

test("PWA files are served; other pages still allow no scripts", async () => {
    const m = await get("/owner/manifest.webmanifest");
    assert.match(m.headers.get("content-type"), /application\/manifest\+json/);
    const manifest = await m.json();
    assert.strictEqual(manifest.start_url, "/owner");
    assert.strictEqual(manifest.display, "standalone");
    const sw = await get("/owner/sw.js");
    assert.strictEqual(sw.headers.get("service-worker-allowed"), "/owner/");
    assert.match(await sw.text(), /never cached/);
    const icon = await get("/owner/icon-192.png");
    assert.strictEqual(icon.headers.get("content-type"), "image/png");
    const png = Buffer.from(await icon.arrayBuffer());
    assert.strictEqual(png.readUInt32BE(16), 192);
    assert.strictEqual((await get("/owner/nope.js")).status, 404);
    assert.strictEqual((await get("/owner/offline")).status, 200);
    const report = await get("/report");
    assert.ok(!/script-src/.test(report.headers.get("content-security-policy")));
});

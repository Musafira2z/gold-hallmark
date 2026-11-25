// Plan 18: karigor / shop owner portal. Run: npm test (needs MONGO_URI; uses its own "<db>_portal" database).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const Report = require("../models/Report");
const Account = require("../models/Account");
const Payment = require("../models/Payment");
const PortalSession = require("../models/PortalSession");
const { createApp, createGuessLimiter, cleanAccount } = require("../app");
const { hashPin } = require("../pin");
const { monthRange } = require("../portal");

const KEY = "test-key-0123456789abcdefghij";
let server;
let base;
const hex = (n) => n.toString(16).padStart(24, "0");
const SHOP = hex(900);
const OTHER_SHOP = hex(901);

const order = (n, extra = {}) => ({
    id: hex(n),
    reportToken: `Prt${String(n).padStart(9, "0")}`,
    reportCode: "AB3D",
    voucher: 2000000 + n,
    type: "hallmark",
    company: "MAA JEWELLERS",
    createdAt: "2026-11-10T05:00:00Z",
    updatedAt: "2026-11-10T05:00:00Z",
    status: "delivered",
    items: [{ item: "Ring", quantity: 2, weight: 2.5, weightUnite: "gm", xray: "MJ 916", purity: "22K", stamp: "MJ" }],
    customerID: "150",
    shopId: SHOP,
    broughtBy: "BIKASH DAS",
    total: 80,
    paid: 80,
    ...extra,
});
const post = (path, body) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
});
const login = (phone, pin) => fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ phone, pin }).toString(),
    redirect: "manual",
});
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];
const get = (path, cookie) => fetch(`${base}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

let karigorPinHash;
let ownerPinHash;

before(async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI needed");
    await mongoose.connect(process.env.MONGO_URI.replace(/\/([^/?]+)(\?|$)/, "/$1_portal$2"));
    await Promise.all([Report, Account, Payment, PortalSession].map((m) => m.deleteMany({})));
    await Promise.all([Report, Account, Payment, PortalSession].map((m) => m.syncIndexes()));
    const app = createApp({
        syncKey: KEY,
        loginIpLimiter: createGuessLimiter({ max: 8 }),
        loginPhoneLimiter: createGuessLimiter({ max: 3 }),
    });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    karigorPinHash = hashPin("123456");
    ownerPinHash = hashPin("654321");
    const r1 = await post("/api/sync/orders", { orders: [
        order(1),                                                          // karigor 150, shop MAA, paid
        order(2, { total: 120, paid: 20, status: "ready", readyAt: "2026-11-11T05:00:00Z", createdAt: "2026-11-11T04:00:00Z" }),
        order(3, { customerID: "77", broughtBy: "RAHIM", total: 500, paid: 0 }), // another karigor at MAA
        order(4, { customerID: "77", broughtBy: "RAHIM", shopId: OTHER_SHOP, company: "OTHER SHOP" }), // other shop
        order(5, { deletedAt: "2026-11-12T00:00:00Z", total: 999, paid: 0 }), // deleted: not counted
        order(6, { createdAt: "2026-10-31T19:00:00Z" }),                  // 1 Nov 01:00 in Dhaka
        order(7, { createdAt: "2026-10-31T17:00:00Z", total: 40, paid: 0 }), // 31 Oct 23:00 in Dhaka
    ] });
    assert.deepStrictEqual(await r1.json(), { saved: 7, skipped: 0 });
});

after(async () => {
    server.close();
    await mongoose.disconnect();
});

test("accounts and payments need the sync key and skip bad records", async () => {
    const bad = await fetch(`${base}/api/sync/accounts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer nope" }, body: "{}" });
    assert.strictEqual(bad.status, 401);
    const a = await post("/api/sync/accounts", { accounts: [
        { id: hex(150), customerID: "150", name: "BIKASH DAS", phone: "01749479627", kind: "karigor", pinHash: karigorPinHash, pinSetAt: "2026-11-01T00:00:00Z", shops: [] },
        { id: hex(88), customerID: "88", name: "MAA OWNER", phone: "01711111111", kind: "shop_owner", pinHash: ownerPinHash, pinSetAt: "2026-11-01T00:00:00Z",
            shops: [{ id: SHOP, name: "MAA JEWELLERS" }, { id: "bad", name: "x" }] },
        { id: "nope", customerID: "1" },
        { id: hex(5), customerID: "abc" },
    ] });
    assert.deepStrictEqual(await a.json(), { saved: 2, skipped: 2 });
    const owner = await Account.findOne({ customerID: "88" }).lean();
    assert.deepStrictEqual(owner.shops, [{ id: SHOP, name: "MAA JEWELLERS" }]);
    assert.strictEqual(cleanAccount({ id: hex(1), customerID: "1", pinHash: "plain-123456" }).pinHash, null);
    assert.strictEqual(cleanAccount({ id: hex(1), customerID: "1", phone: "12345", pinHash: karigorPinHash }).phone, "");
    const p = await post("/api/sync/payments", { payments: [
        { id: hex(501), customerID: "150", amount: 30, at: "2026-11-15T06:00:00Z" },
        { id: hex(502), customerID: "150", amount: 1000, at: "2026-11-15T06:00:00Z", deletedAt: "2026-11-16T06:00:00Z" },
        { id: hex(503), customerID: "150", amount: "x" },
    ] });
    assert.deepStrictEqual(await p.json(), { saved: 2, skipped: 1 });
});

test("login: wrong PIN refused, right PIN gives a session cookie", async () => {
    assert.strictEqual((await get("/me")).status, 303);
    assert.strictEqual((await get("/me")).headers.get("location"), "/login");
    const page = await get("/login");
    assert.strictEqual(page.status, 200);
    assert.match(await page.text(), /PIN/);
    const wrong = await login("01749479627", "000000");
    assert.strictEqual(wrong.status, 401);
    assert.match(await wrong.text(), /Wrong phone number or PIN/);
    const ok = await login("+880 1749-479627", "123456");
    assert.strictEqual(ok.status, 303);
    assert.strictEqual(ok.headers.get("location"), "/me");
    const setCookie = ok.headers.get("set-cookie");
    assert.match(setCookie, /^gh_s=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
    const stored = await PortalSession.findOne({}).lean();
    assert.ok(!setCookie.includes(stored._id), "only a hash of the token is stored");
    assert.strictEqual((await get("/login", cookieOf(ok))).headers.get("location"), "/me");
});

test("karigor sees only their own tests, with taka and dues", async () => {
    const c = cookieOf(await login("01749479627", "123456"));
    const res = await get("/me", c);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("cache-control"), "no-store");
    const html = await res.text();
    assert.match(html, /BIKASH DAS/);
    assert.match(html, /All tests · সব পরীক্ষা \(4\)/); // 1, 2, 6, 7 (5 is deleted; 3, 4 belong to 77)
    assert.ok(!html.includes("RAHIM") && !html.includes("2000003") && !html.includes("2000005"));
    // due = (80+120+80+40) - (80+20+80+0) - 30 (the deleted 1000 does not count) = 110
    assert.match(html, /Due · বাকি<\/div><div class="v">৳110</);
    assert.match(html, /Ready for pickup · নিয়ে যাওয়ার জন্য প্রস্তুত \(1\)/);
    assert.match(html, /href="\/r\/Prt000000002"/);
    assert.match(html, /22K gold/);
    const ready = await (await get("/me?status=ready", c)).text();
    assert.match(ready, /Found 1/);
    const memo = await (await get("/me?memo=2000006", c)).text();
    assert.match(memo, /Found 1/);
    const other = await (await get("/me?memo=2000003", c)).text();
    assert.match(other, /Found 0/);
});

test("month and statement use Dhaka time", async () => {
    const r = monthRange("2026-11");
    assert.strictEqual(r.start.toISOString(), "2026-10-31T18:00:00.000Z");
    assert.strictEqual(r.end.toISOString(), "2026-11-30T18:00:00.000Z");
    assert.strictEqual(monthRange("2026-13").key.length, 7);
    assert.strictEqual(monthRange("2026-01").prev, "2025-12");
    const c = cookieOf(await login("01749479627", "123456"));
    const nov = await (await get("/me/statement?month=2026-11", c)).text();
    assert.match(nov, /Tests · পরীক্ষা<\/dt><dd>3 \(6 pcs\)/); // 1, 2, 6
    assert.match(nov, /Billed · বিল<\/dt><dd>৳280/);
    assert.match(nov, /Paid later · পরে জমা<\/dt><dd>৳30/);
    assert.match(nov, /এখন মোট বাকি<\/div><div class="v">৳110/);
    const oct = await (await get("/me/statement?month=2026-10", c)).text();
    assert.match(oct, /Tests · পরীক্ষা<\/dt><dd>1 \(2 pcs\)/); // 7
    const novList = await (await get("/me?month=2026-11", c)).text();
    assert.match(novList, /Found 3/);
});

test("shop owner sees their shop's tests, but no taka on other people's orders", async () => {
    const c = cookieOf(await login("01711111111", "654321"));
    const html = await (await get("/me", c)).text();
    assert.match(html, /MAA OWNER/);
    assert.match(html, /All tests · সব পরীক্ষা \(5\)/); // 1, 2, 3, 6, 7 at MAA; not 4 (other shop) or 5 (deleted)
    assert.match(html, /Brought by RAHIM/);
    assert.match(html, /Brought by BIKASH DAS/);
    assert.ok(!html.includes("৳500") && !html.includes("৳120"), "no bill of other customers");
    assert.ok(!html.includes("OTHER SHOP"));
    assert.match(html, /<option value="[0-9a-f]{24}">MAA JEWELLERS<\/option>/);
    const statement = await (await get("/me/statement?month=2026-11", c)).text();
    assert.match(statement, /Tests · পরীক্ষা<\/dt><dd>0 /, "statement is only their own orders");
    const notMine = await (await get(`/me?shop=${OTHER_SHOP}`, c)).text();
    assert.match(notMine, /All tests · সব পরীক্ষা \(5\)/, "a shop that is not theirs is ignored");
});

test("public report never shows taka, who brought it, or the customer", async () => {
    const html = await (await get("/r/Prt000000003")).text();
    assert.ok(!html.includes("৳") && !html.includes("RAHIM") && !html.includes("BIKASH"));
    assert.match(html, /Karigor \/ shop login/);
});

test("too many wrong PINs lock the phone, then the address", async () => {
    for (let i = 0; i < 3; i += 1) assert.strictEqual((await login("01722222222", "111111")).status, 401);
    assert.strictEqual((await login("01722222222", "111111")).status, 429);
    const locked = await login("01722222222", "111111");
    assert.match(await locked.text(), /15 minutes/);
    // 1 wrong in the login test + 3 here = 4 from this address (blocked tries don't count); 4 more reach the limit of 8
    for (let i = 0; i < 4; i += 1) await login(`0173333333${i}`, "111111");
    const blocked = await login("01749479627", "123456");
    assert.strictEqual(blocked.status, 429, "even the right PIN waits once the address is blocked");
});

test("a new PIN logs out old sessions; a turned-off login stops; logout ends the session", async () => {
    const fresh = createApp({ syncKey: KEY });
    const s2 = await new Promise((resolve) => { const s = fresh.listen(0, () => resolve(s)); });
    const b2 = `http://127.0.0.1:${s2.address().port}`;
    const login2 = (phone, pin) => fetch(`${b2}/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ phone, pin }).toString(), redirect: "manual" });
    const get2 = (path, cookie) => fetch(`${b2}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    try {
        const c = cookieOf(await login2("01749479627", "123456"));
        assert.strictEqual((await get2("/me", c)).status, 200);
        await Account.updateOne({ customerID: "150" }, { $set: { pinSetAt: new Date(Date.now() + 1000), pinHash: hashPin("222222") } });
        const out = await get2("/me", c);
        assert.strictEqual(out.status, 303, "old session ends after a new PIN");
        assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
        assert.strictEqual((await login2("01749479627", "123456")).status, 401, "old PIN no longer works");
        await Account.updateOne({ customerID: "150" }, { $set: { pinSetAt: new Date(Date.now() - 1000) } });
        const c2 = cookieOf(await login2("01749479627", "222222"));
        assert.strictEqual((await get2("/me", c2)).status, 200);
        const lo = await fetch(`${b2}/logout`, { method: "POST", headers: { cookie: c2 }, redirect: "manual" });
        assert.strictEqual(lo.status, 303);
        assert.strictEqual((await get2("/me", c2)).status, 303, "logged out");
        const c3 = cookieOf(await login2("01749479627", "222222"));
        await Account.updateOne({ customerID: "150" }, { $set: { pinHash: null } });
        assert.strictEqual((await get2("/me", c3)).status, 303, "turned off");
        assert.strictEqual((await login2("01749479627", "222222")).status, 401);
    } finally {
        s2.close();
    }
});

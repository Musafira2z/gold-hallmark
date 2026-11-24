// Run: npm test (needs MONGO_URI pointing at a throwaway database).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const Report = require("../models/Report");
const { createApp, createGuessLimiter, cleanIncoming } = require("../app");

const KEY = "test-key-0123456789abcdefghij";
let server;
let base;

const order = (n, extra = {}) => ({
    id: n.toString(16).padStart(24, "0"),
    reportToken: `Tok${String(n).padStart(9, "0")}`,
    reportCode: "AB3D",
    voucher: 1000000 + n,
    type: "hallmark",
    company: "Test Shop <b>",
    createdAt: "2026-11-24T05:00:00Z",
    updatedAt: "2026-11-24T05:00:00Z",
    contact: "01700000000",
    totalAmount: 500,
    items: [{ item: "Ring", quantity: 1, weight: 2.5, weightUnite: "gm", xray: "PJ 916", purity: "22K", stamp: "PJ", rate: 500 }],
    ...extra,
});

const send = (orders, key = KEY) =>
    fetch(`${base}/api/sync/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ orders }),
    });

before(async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI needed");
    await mongoose.connect(process.env.MONGO_URI);
    await Report.deleteMany({});
    await Report.syncIndexes();
    const app = createApp({ syncKey: KEY, limiter: createGuessLimiter({ max: 3 }) });
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await Report.deleteMany({});
    await mongoose.disconnect();
    server.close();
});

test("refuses a wrong or missing key", async () => {
    assert.equal((await send([order(1)], "wrong-key")).status, 401);
    assert.equal((await send([order(1)], "")).status, 401);
    assert.equal(await Report.countDocuments(), 0);
});

test("saves orders, repeats are harmless, private fields are dropped", async () => {
    let res = await send([order(1), order(2), { id: "bad" }]);
    assert.deepEqual(await res.json(), { saved: 2, skipped: 1 });
    res = await send([order(1), order(2)]);
    assert.equal(res.status, 200);
    assert.equal(await Report.countDocuments(), 2);
    const doc = await Report.findOne({ voucher: 1000001 }).lean();
    assert.equal(doc.contact, undefined);
    assert.equal(doc.totalAmount, undefined);
    assert.equal(doc.items[0].rate, undefined);
});

test("report page by token, escaped, and 404 for unknown", async () => {
    let res = await fetch(`${base}/r/${order(1).reportToken}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Verified report/);
    assert.match(html, /22K gold/);
    assert.match(html, /91\.6%/);
    assert.match(html, /PJ 916/);
    assert.doesNotMatch(html, /Ready for pickup/);
    assert.match(html, /Test Shop &lt;b&gt;/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    res = await fetch(`${base}/r/Tok999999999`);
    assert.equal(res.status, 404);
    res = await fetch(`${base}/r/..%2F..%2Fetc`);
    assert.equal(res.status, 404);
});

test("edits and deletes show on the report", async () => {
    await send([order(2, { editedAt: "2026-11-25T05:00:00Z", items: [{ item: "Chain", xray: "21K" }] })]);
    let html = await (await fetch(`${base}/r/${order(2).reportToken}`)).text();
    assert.match(html, /Corrected/);
    assert.match(html, /Chain/);
    assert.doesNotMatch(html, /Ring/);
    await send([order(2, { deletedAt: "2026-11-26T05:00:00Z" })]);
    html = await (await fetch(`${base}/r/${order(2).reportToken}`)).text();
    assert.match(html, /Cancelled report/);
    assert.doesNotMatch(html, /Verified report/);
});

test("memo number + code finds the report; wrong tries get blocked", async () => {
    let res = await fetch(`${base}/report?memo=1000001&code=ab3d`, { redirect: "manual" });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), `/r/${order(1).reportToken}`);
    for (let i = 0; i < 3; i += 1) {
        res = await fetch(`${base}/report?memo=1000001&code=ZZZZ`);
        assert.equal(res.status, 404);
    }
    res = await fetch(`${base}/report?memo=1000001&code=AB3D`, { redirect: "manual" });
    assert.equal(res.status, 429, "blocked even with the right code after too many wrong tries");
});

test("ready orders say so; bad status/purity values are dropped", async () => {
    await send([order(3, { status: "ready", readyAt: "2026-11-24T06:00:00Z" })]);
    const html = await (await fetch(`${base}/r/${order(3).reportToken}`)).text();
    assert.match(html, /Ready for pickup/);
    const clean = cleanIncoming(order(4, { status: "hacked", items: [{ item: "X", purity: "<b>", xray: "1" }] }));
    assert.equal(clean.status, "delivered");
    assert.equal(clean.items[0].purity, null);
});

test("cleanIncoming rejects bad tokens and codes", () => {
    assert.equal(cleanIncoming(order(5, { reportToken: "short" })), null);
    assert.equal(cleanIncoming(order(5, { reportCode: "ab3d" })), null);
    assert.equal(cleanIncoming(order(5, { id: { $gt: "" } })), null);
    assert.ok(cleanIncoming(order(5)));
});

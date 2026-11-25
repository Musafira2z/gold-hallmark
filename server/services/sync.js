// One-way sync: shop PC -> website (Plan 14 / S1, Plan 18 / S4).
// The PC keeps the real data. Every SYNC_EVERY_SECONDS it sends records that are
// new or changed since the last good send. If the website or the internet is down,
// it simply tries again later; saving orders never waits for this.
// Three streams, each with its own cursor:
//   orders    every order with a report link (the public report + the customer portal)
//   payments  later payments (portal: dues)
//   accounts  customers who have, or had, an online login PIN (portal login)
//   owners    the owner's phone app code (Plan 19)
// After each good round the PC also sends a heartbeat: alive, version, newest backup.
// Settings (all optional; without SYNC_URL + SYNC_KEY sync is off):
//   SYNC_URL            e.g. https://sylhethallmark.com
//   SYNC_KEY            the shared secret, same as on the website
//   SYNC_EVERY_SECONDS  default 60
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Staff = require("../models/Staff");
const { heartbeat } = require("./pcHealth");
const SyncState = require("../models/SyncState");
const Shop = require("../models/Shop");
const { loginPhone } = require("./portalPin");

const BATCH = 200;
const SETTLE_MS = 5000; // stay 5 s behind the clock so a save in progress is never skipped
const EPOCH = new Date(0);

const settings = () => ({
    url: (process.env.SYNC_URL || "").trim().replace(/\/+$/, ""),
    key: (process.env.SYNC_KEY || "").trim(),
    everySeconds: Math.max(10, Number(process.env.SYNC_EVERY_SECONDS) || 60),
});

// A few very old orders keep one item at the top level (item, quantity) instead of a list.
const itemsOf = (o) => {
    if (Array.isArray(o.items) && o.items.length > 0) return o.items;
    return o.item ? [{ item: o.item, quantity: o.quantity, weightUnite: o.weightUnite }] : [];
};

const shopNamesFor = async (ids) => {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (unique.length === 0) return new Map();
    return new Map((await Shop.find({ _id: { $in: unique } }, { name: 1 }).lean()).map((s) => [String(s._id), s.name]));
};

// The public report shows only the test (items, result, dates, shop name).
// customerID, shopId, broughtBy, total and paid are for the logged-in portal only;
// the website never puts them on the public page. No phone is ever sent with an order.
const toReport = (o, shopNames = new Map()) => ({
    id: String(o._id),
    reportToken: o.reportToken,
    reportCode: o.reportCode,
    voucher: o.voucher ?? null,
    type: o.type || "",
    company: (o.shopId && shopNames.get(String(o.shopId))) || (o.shopId === null ? "" : o.company || ""),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    editedAt: o.editedAt || null,
    status: o.status || "delivered",
    readyAt: o.readyAt || null,
    deletedAt: o.deletedAt || null,
    items: itemsOf(o).map((it) => ({
        item: it.item || "",
        quantity: it.quantity ?? null,
        weight: it.weight ?? null,
        weightUnite: it.weightUnite || "",
        xray: it.xray || "",
        purity: it.purity || null,
        stamp: it.stamp || "",
    })),
    customerID: o.customerID ? String(o.customerID) : "",
    shopId: o.shopId ? String(o.shopId) : null,
    broughtBy: o.name || "",
    total: o.totalAmount ?? 0,
    paid: o.paidAmount ?? o.totalAmount ?? 0, // old orders without paidAmount were paid in full
});

const toPayment = (p) => ({
    id: String(p._id),
    customerID: String(p.customerID),
    amount: p.amount,
    at: p.at,
    deletedAt: p.deletedAt || null,
});

// A customer with no PIN (turned off, or deleted) is still sent, without a PIN hash,
// so the website stops their login.
const toAccount = (u, shopNames = new Map()) => ({
    id: String(u._id),
    customerID: String(u.customerID),
    name: u.name || "",
    phone: loginPhone(u.contact) || "",
    kind: u.kind || "",
    pinHash: u.portalPinHash && !u.portalOffAt && !u.deletedAt ? u.portalPinHash : null,
    pinSetAt: u.portalPinSetAt || null,
    shops: u.kind === "shop_owner"
        ? (u.portalShops || []).map((id) => ({ id: String(id), name: shopNames.get(String(id)) || "" })).filter((s) => s.name)
        : [],
});

// The owner's phone app login (Plan 19). No code hash once it is off, or the account is no longer an active owner.
const toOwner = (s) => ({
    id: String(s._id),
    name: s.name || "",
    codeHash: s.ownerAppCodeHash && !s.ownerAppOffAt && s.active !== false && s.role === "owner" ? s.ownerAppCodeHash : null,
    codeSetAt: s.ownerAppCodeSetAt || null,
});

// Raise a stream's schema when the data it sends changes shape: that stream is sent again once.
// Orders include the Hall Mark reader version, because a new reader changes purity/stamp
// on old orders without changing their updatedAt.
const STREAMS = [
    {
        id: "orders",
        schema: 4 * 100 + require("./hallmarkText").PARSE_VERSION, // 4: portal fields
        model: Order,
        filter: { reportToken: { $exists: true } },
        path: "/api/sync/orders",
        key: "orders",
        prepare: async (batch) => {
            const names = await shopNamesFor(batch.map((o) => o.shopId));
            return batch.map((o) => toReport(o, names));
        },
    },
    {
        id: "payments",
        schema: 1,
        model: Payment,
        filter: {},
        path: "/api/sync/payments",
        key: "payments",
        prepare: async (batch) => batch.map(toPayment),
    },
    {
        id: "accounts",
        schema: 1,
        model: User,
        select: "+portalPinHash",
        filter: { portalPinSetAt: { $exists: true } },
        path: "/api/sync/accounts",
        key: "accounts",
        prepare: async (batch) => {
            const names = await shopNamesFor(batch.flatMap((u) => u.portalShops || []));
            return batch.map((u) => toAccount(u, names));
        },
    },
    {
        id: "owners",
        schema: 1,
        model: Staff,
        select: "+ownerAppCodeHash",
        filter: { ownerAppCodeSetAt: { $exists: true } },
        path: "/api/sync/owners",
        key: "owners",
        prepare: async (batch) => batch.map(toOwner),
    },
];

const changedSince = (stream, state, before) => {
    const at = state.cursorAt || EPOCH;
    const after = state.cursorId
        ? { $or: [{ updatedAt: { $gt: at } }, { updatedAt: at, _id: { $gt: state.cursorId } }] }
        : { updatedAt: { $gte: at } };
    return { $and: [{ updatedAt: { $lt: before } }, stream.filter, after] };
};

// Send one stream until nothing is left. Throws if the website fails; the cursor keeps what was sent.
const sendStream = async (stream, { url, key }) => {
    let sent = 0;
    let state = (await SyncState.findById(stream.id).lean()) || { _id: stream.id };
    if (state.schema !== stream.schema) {
        console.log(`Sync: ${stream.id} data format ${stream.schema}, sending all ${stream.id} again.`);
        await SyncState.updateOne(
            { _id: stream.id },
            { $set: { schema: stream.schema }, $unset: { cursorAt: 1, cursorId: 1 } },
            { upsert: true }
        );
        state = { _id: stream.id, schema: stream.schema };
    }
    const before = new Date(Date.now() - SETTLE_MS);
    for (;;) {
        let query = stream.model.find(changedSince(stream, state, before)).sort({ updatedAt: 1, _id: 1 }).limit(BATCH);
        if (stream.select) query = query.select(stream.select);
        const batch = await query.lean();
        if (batch.length > 0) {
            const res = await fetch(`${url}${stream.path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({ [stream.key]: await stream.prepare(batch) }),
                signal: AbortSignal.timeout(30000),
            });
            if (!res.ok) throw new Error(`Website answered ${res.status} (${stream.id})`);
            const last = batch[batch.length - 1];
            state.cursorAt = last.updatedAt;
            state.cursorId = last._id;
            sent += batch.length;
            await SyncState.updateOne(
                { _id: stream.id },
                { $set: { cursorAt: state.cursorAt, cursorId: state.cursorId }, $inc: { sent: batch.length } },
                { upsert: true }
            );
        }
        if (batch.length < BATCH) break;
    }
    return sent;
};

let running = false;

// One round: every stream in turn. Orders keep the overall last-OK / error status.
const syncOnce = async () => {
    const { url, key } = settings();
    if (!url || !key || running) return { skipped: true };
    running = true;
    const sent = {};
    try {
        for (const stream of STREAMS) sent[stream.id] = await sendStream(stream, { url, key });
        // Heartbeat for the owner's phone: PC alive, version, newest backup (Plan 19).
        const beat = await fetch(`${url}/api/sync/heartbeat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify(await heartbeat()),
            signal: AbortSignal.timeout(30000),
        });
        if (!beat.ok) throw new Error(`Website answered ${beat.status} (heartbeat)`);
        await SyncState.updateOne(
            { _id: "orders" },
            { $set: { lastOkAt: new Date(), lastTryAt: new Date(), lastError: "" } },
            { upsert: true }
        );
        const total = Object.values(sent).reduce((a, b) => a + b, 0);
        if (total > 0) console.log(`Sync: sent ${Object.entries(sent).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ")}.`);
        return { sent: sent.orders || 0, ...Object.fromEntries(Object.entries(sent).map(([k, n]) => [`${k}Sent`, n])) };
    } catch (error) {
        const message = error.name === "TimeoutError" ? "Website did not answer in time" : error.message;
        await SyncState.updateOne(
            { _id: "orders" },
            { $set: { lastTryAt: new Date(), lastError: message } },
            { upsert: true }
        ).catch(() => {});
        console.warn(`Sync: will try again later (${message}).`);
        return { sent: sent.orders || 0, error: message };
    } finally {
        running = false;
    }
};

// For the staff app: "last sync 5 min ago" / "12 waiting".
const syncStatus = async () => {
    const { url, key } = settings();
    const states = new Map((await SyncState.find({ _id: { $in: STREAMS.map((s) => s.id) } }).lean()).map((s) => [s._id, s]));
    const now = new Date();
    let waiting = 0;
    for (const stream of STREAMS) {
        waiting += await stream.model.countDocuments(changedSince(stream, states.get(stream.id) || {}, now));
    }
    const state = states.get("orders") || {};
    return {
        enabled: Boolean(url && key),
        lastOkAt: state.lastOkAt || null,
        lastTryAt: state.lastTryAt || null,
        lastError: state.lastError || "",
        sent: state.sent || 0,
        waiting,
    };
};

const startSync = () => {
    const { url, key, everySeconds } = settings();
    if (!url || !key) {
        console.log("Sync is off (SYNC_URL / SYNC_KEY not set).");
        return;
    }
    if (!/^https:\/\//.test(url)) console.warn("Sync: SYNC_URL is not https. Use https for the real website.");
    console.log(`Sync is on: every ${everySeconds} s to ${url}`);
    setTimeout(syncOnce, 5000);
    setInterval(syncOnce, everySeconds * 1000);
};

module.exports = { startSync, syncOnce, syncStatus, toReport, toAccount, toPayment, toOwner };

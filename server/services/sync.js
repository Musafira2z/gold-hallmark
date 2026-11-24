// One-way sync: shop PC -> website (Plan 14 / S1).
// The PC keeps the real data. Every SYNC_EVERY_SECONDS it sends orders that are
// new or changed since the last good send. If the website or the internet is down,
// it simply tries again later; saving orders never waits for this.
// Settings (all optional; without SYNC_URL + SYNC_KEY sync is off):
//   SYNC_URL            e.g. https://sylhethallmark.com
//   SYNC_KEY            the shared secret, same as on the website
//   SYNC_EVERY_SECONDS  default 60
const Order = require("../models/Order");
const SyncState = require("../models/SyncState");

const BATCH = 200;
const SETTLE_MS = 5000; // stay 5 s behind the clock so a save in progress is never skipped
const STATE_ID = "orders";
// Raise when the data sent to the website changes shape: everything is sent again once.
// The Hall Mark reader version is part of it, because a new reader changes purity/stamp
// on old orders without changing their updatedAt.
const SYNC_SCHEMA = 2 * 100 + require("./hallmarkText").PARSE_VERSION;
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

// Only what the public report needs. No phone, bill, payments or dues.
const toReport = (o) => ({
    id: String(o._id),
    reportToken: o.reportToken,
    reportCode: o.reportCode,
    voucher: o.voucher ?? null,
    type: o.type || "",
    company: o.company || "",
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
});

const changedSince = (state, before) => {
    const at = state.cursorAt || EPOCH;
    const after = state.cursorId
        ? { $or: [{ updatedAt: { $gt: at } }, { updatedAt: at, _id: { $gt: state.cursorId } }] }
        : { updatedAt: { $gte: at } };
    return { $and: [{ updatedAt: { $lt: before } }, { reportToken: { $exists: true } }, after] };
};

let running = false;

// One round: send batches until nothing is left or something fails.
const syncOnce = async () => {
    const { url, key } = settings();
    if (!url || !key || running) return { skipped: true };
    running = true;
    let sentNow = 0;
    try {
        let state = (await SyncState.findById(STATE_ID).lean()) || { _id: STATE_ID };
        if (state.schema !== SYNC_SCHEMA) {
            console.log(`Sync: data format ${SYNC_SCHEMA}, sending everything again.`);
            await SyncState.updateOne(
                { _id: STATE_ID },
                { $set: { schema: SYNC_SCHEMA }, $unset: { cursorAt: 1, cursorId: 1 } },
                { upsert: true }
            );
            state = { _id: STATE_ID, schema: SYNC_SCHEMA };
        }
        const before = new Date(Date.now() - SETTLE_MS);
        for (;;) {
            const batch = await Order.find(changedSince(state, before))
                .sort({ updatedAt: 1, _id: 1 })
                .limit(BATCH)
                .lean();
            if (batch.length > 0) {
                const res = await fetch(`${url}/api/sync/orders`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                    body: JSON.stringify({ orders: batch.map(toReport) }),
                    signal: AbortSignal.timeout(30000),
                });
                if (!res.ok) throw new Error(`Website answered ${res.status}`);
                const last = batch[batch.length - 1];
                state.cursorAt = last.updatedAt;
                state.cursorId = last._id;
                sentNow += batch.length;
                await SyncState.updateOne(
                    { _id: STATE_ID },
                    { $set: { cursorAt: state.cursorAt, cursorId: state.cursorId }, $inc: { sent: batch.length } },
                    { upsert: true }
                );
            }
            if (batch.length < BATCH) break;
        }
        await SyncState.updateOne(
            { _id: STATE_ID },
            { $set: { lastOkAt: new Date(), lastTryAt: new Date(), lastError: "" } },
            { upsert: true }
        );
        if (sentNow > 0) console.log(`Sync: ${sentNow} order(s) sent to the website.`);
        return { sent: sentNow };
    } catch (error) {
        const message = error.name === "TimeoutError" ? "Website did not answer in time" : error.message;
        await SyncState.updateOne(
            { _id: STATE_ID },
            { $set: { lastTryAt: new Date(), lastError: message } },
            { upsert: true }
        ).catch(() => {});
        console.warn(`Sync: will try again later (${message}). Sent this round: ${sentNow}.`);
        return { sent: sentNow, error: message };
    } finally {
        running = false;
    }
};

// For the staff app: "last sync 5 min ago" / "12 waiting".
const syncStatus = async () => {
    const { url, key } = settings();
    const state = (await SyncState.findById(STATE_ID).lean()) || {};
    const waiting = await Order.countDocuments(changedSince(state, new Date()));
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

module.exports = { startSync, syncOnce, syncStatus, toReport };

// Numbers for the owner's phone app (Plan 19). Same rules as the shop app's Today page:
// Dhaka days, deleted orders left out, cash = paid with orders + later payments,
// dues = sum over customers who owe (an advance of one customer doesn't cancel another's due).
const Report = require("./models/Report");
const Payment = require("./models/Payment");
const { monthRange } = require("./portal");

const DAY_MS = 24 * 60 * 60 * 1000;
const DHAKA_MS = 6 * 60 * 60 * 1000;
const TZ = "Asia/Dhaka";
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const dayStart = (d) => new Date(Math.floor((d.getTime() + DHAKA_MS) / DAY_MS) * DAY_MS - DHAKA_MS);
const dayKey = (d) => new Date(d.getTime() + DHAKA_MS).toISOString().slice(0, 10);
const LIVE = { deletedAt: null };

// Orders, pieces, bill and cash between two times.
const totalsBetween = async (start, end) => {
    const [[o], [p]] = await Promise.all([
        Report.aggregate([
            { $match: { ...LIVE, orderedAt: { $gte: start, $lt: end } } },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    pieces: { $sum: { $sum: "$items.quantity" } },
                    billed: { $sum: { $ifNull: ["$total", 0] } },
                    paid: { $sum: { $ifNull: ["$paid", 0] } },
                    hallmark: { $sum: { $cond: [{ $eq: ["$type", "hallmark"] }, 1, 0] } },
                    xray: { $sum: { $cond: [{ $eq: ["$type", "xray"] }, 1, 0] } },
                },
            },
        ]),
        Payment.aggregate([
            { $match: { deletedAt: null, at: { $gte: start, $lt: end } } },
            { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]),
    ]);
    const paidAtOrder = round2(o?.paid);
    const paidLater = round2(p?.amount);
    return {
        orders: o?.orders || 0,
        pieces: round2(o?.pieces),
        billed: round2(o?.billed),
        paidAtOrder,
        paidLater,
        cash: round2(paidAtOrder + paidLater),
        hallmark: o?.hallmark || 0,
        xray: o?.xray || 0,
    };
};

// Latest name we have for each customer (from who brought their orders).
const namesOf = async (ids) => {
    if (!ids.length) return new Map();
    const rows = await Report.aggregate([
        { $match: { customerID: { $in: ids } } },
        { $sort: { orderedAt: -1 } },
        { $group: { _id: "$customerID", name: { $first: "$broughtBy" } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.name || ""]));
};

const duesOf = async (top = 10) => {
    const [orders, payments] = await Promise.all([
        Report.aggregate([
            { $match: LIVE },
            { $group: { _id: "$customerID", owed: { $sum: { $subtract: [{ $ifNull: ["$total", 0] }, { $ifNull: ["$paid", 0] }] } } } },
            { $match: { owed: { $ne: 0 } } },
        ]),
        Payment.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: "$customerID", paid: { $sum: "$amount" } } },
        ]),
    ]);
    const due = new Map();
    orders.forEach((o) => due.set(String(o._id), o.owed));
    payments.forEach((p) => due.set(String(p._id), (due.get(String(p._id)) || 0) - p.paid));
    let total = 0;
    const owing = [];
    due.forEach((v, id) => {
        if (round2(v) > 0) {
            total += v;
            owing.push({ customerID: id, due: round2(v) });
        }
    });
    owing.sort((a, b) => b.due - a.due);
    const list = owing.slice(0, top);
    const names = await namesOf(list.map((d) => d.customerID));
    return { total: round2(total), customers: owing.length, top: list.map((d) => ({ ...d, name: names.get(d.customerID) || "" })) };
};

const ownerStats = async ({ now = new Date(), month = "" } = {}) => {
    const todayStart = dayStart(now);
    const lastWeekStart = new Date(todayStart.getTime() - 7 * DAY_MS);
    const lastWeekNow = new Date(now.getTime() - 7 * DAY_MS);

    const current = monthRange("", now);
    const picked = month ? monthRange(month, now) : current;
    const isCurrent = picked.key === current.key;
    // This month: compare with last month up to the same point. Another month: with the whole month before.
    const prev = monthRange(picked.prev, now);
    const monthEnd = isCurrent ? now : picked.end;
    const prevEnd = isCurrent ? new Date(Math.min(prev.start.getTime() + (now - picked.start), prev.end.getTime())) : prev.end;
    const days30 = new Date(todayStart.getTime() - 29 * DAY_MS);
    const inMonth = { ...LIVE, orderedAt: { $gte: picked.start, $lt: picked.end } };

    const [today, lastWeek, monthT, prevT, dues, daily, topCustomers, topShops, purity, waitingRows, latest] = await Promise.all([
        totalsBetween(todayStart, now),
        totalsBetween(lastWeekStart, lastWeekNow),
        totalsBetween(picked.start, monthEnd),
        totalsBetween(prev.start, prevEnd),
        duesOf(10),
        Report.aggregate([
            { $match: { ...LIVE, orderedAt: { $gte: days30, $lt: now } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderedAt", timezone: TZ } }, orders: { $sum: 1 }, billed: { $sum: { $ifNull: ["$total", 0] } } } },
        ]),
        Report.aggregate([
            { $match: { ...inMonth, customerID: { $nin: [null, ""] } } },
            { $sort: { orderedAt: 1 } },
            { $group: { _id: "$customerID", orders: { $sum: 1 }, billed: { $sum: { $ifNull: ["$total", 0] } }, name: { $last: "$broughtBy" } } },
            { $sort: { billed: -1, orders: -1 } },
            { $limit: 8 },
        ]),
        Report.aggregate([
            { $match: { ...inMonth, shopId: { $nin: [null, ""] } } },
            { $sort: { orderedAt: 1 } },
            { $group: { _id: "$shopId", orders: { $sum: 1 }, pieces: { $sum: { $sum: "$items.quantity" } }, name: { $last: "$company" } } },
            { $sort: { orders: -1, pieces: -1 } },
            { $limit: 8 },
        ]),
        Report.aggregate([
            { $match: inMonth },
            { $unwind: "$items" },
            { $group: { _id: { $ifNull: ["$items.purity", "other"] }, pieces: { $sum: { $ifNull: ["$items.quantity", 1] } } } },
            { $sort: { pieces: -1 } },
        ]),
        Report.aggregate([
            { $match: { ...LIVE, status: { $in: ["received", "ready"] } } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]),
        Report.find(LIVE).sort({ orderedAt: -1, _id: -1 }).limit(10).lean(),
    ]);

    const byDay = new Map(daily.map((d) => [d._id, d]));
    const last30 = [];
    for (let i = 29; i >= 0; i -= 1) {
        const key = dayKey(new Date(todayStart.getTime() - i * DAY_MS));
        const row = byDay.get(key);
        last30.push({ day: key, orders: row ? row.orders : 0, billed: round2(row ? row.billed : 0) });
    }
    const waitingBy = Object.fromEntries(waitingRows.map((r) => [r._id, r.n]));
    return {
        now,
        day: dayKey(now),
        today,
        lastWeek,
        month: { key: picked.key, prev: picked.prev, next: picked.next, isCurrent, ...monthT },
        prevMonth: { key: prev.key, ...prevT },
        dues,
        last30,
        topCustomers: topCustomers.map((c) => ({ customerID: c._id, name: c.name || "", orders: c.orders, billed: round2(c.billed) })),
        topShops: topShops.map((s) => ({ id: s._id, name: s.name || "", orders: s.orders, pieces: round2(s.pieces) })),
        purity: purity.map((p) => ({ purity: p._id, pieces: round2(p.pieces) })),
        waiting: { received: waitingBy.received || 0, ready: waitingBy.ready || 0 },
        latest,
    };
};

// Traffic light for the PC: seen by the website (our clock), and its newest backup.
const health = (beat, now = new Date()) => {
    if (!beat) return { pc: "red", backup: "red", seenMin: null, backupHours: null };
    const seenMin = Math.max(0, Math.round((now - new Date(beat.receivedAt)) / 60000));
    const backupHours = beat.backup && beat.backup.at ? Math.max(0, (now - new Date(beat.backup.at)) / 3600000) : null;
    return {
        pc: seenMin < 10 ? "green" : seenMin < 120 ? "amber" : "red",
        backup: backupHours === null ? "red" : backupHours < 24 ? "green" : backupHours < 72 ? "amber" : "red",
        seenMin,
        backupHours,
    };
};

module.exports = { ownerStats, totalsBetween, duesOf, health, dayStart, dayKey };

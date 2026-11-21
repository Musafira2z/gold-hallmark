// Month helpers and per-customer numbers for the customer profile page.
// The shop is in Bangladesh (UTC+6, no daylight saving), so "this month"
// and day boundaries are counted in Asia/Dhaka time, not server time.
const Order = require("../models/Order");

const TZ = "Asia/Dhaka";
const TZ_OFFSET = "+06:00";

// "2026-11" -> { start, end } as Date, in Dhaka time. null if not YYYY-MM.
exports.monthRange = (month) => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
    if (!match) return null;
    const year = Number(match[1]);
    const mon = Number(match[2]);
    if (mon < 1 || mon > 12) return null;
    const nextYear = mon === 12 ? year + 1 : year;
    const nextMon = mon === 12 ? 1 : mon + 1;
    const pad = (n) => String(n).padStart(2, "0");
    return {
        start: new Date(`${year}-${pad(mon)}-01T00:00:00${TZ_OFFSET}`),
        end: new Date(`${nextYear}-${pad(nextMon)}-01T00:00:00${TZ_OFFSET}`),
    };
};

// Month key ("2026-11") of a date in Dhaka time, shifted by `offset` months.
const monthKey = (date, offset = 0) => {
    const dhaka = new Date(date.getTime() + 6 * 60 * 60 * 1000);
    const total = dhaka.getUTCFullYear() * 12 + dhaka.getUTCMonth() + offset;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};
exports.monthKey = monthKey;

const sumAmount = { $ifNull: ["$totalAmount", 0] };
const sumPieces = {
    $sum: {
        $map: { input: { $ifNull: ["$items", []] }, as: "i", in: { $ifNull: ["$$i.quantity", 0] } },
    },
};

// All numbers for one customer in a single aggregation.
// customerID is a Number on users but a String on orders, so match on the string.
exports.getCustomerStats = async (customerID, now = new Date()) => {
    const id = String(customerID);
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(now, -1);

    const [result] = await Order.aggregate([
        { $match: { customerID: id, deletedAt: null } },
        {
            $addFields: {
                _month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: TZ } },
                _pieces: sumPieces,
                _amount: sumAmount,
            },
        },
        {
            $facet: {
                lifetime: [
                    {
                        $group: {
                            _id: null,
                            orders: { $sum: 1 },
                            pieces: { $sum: "$_pieces" },
                            amount: { $sum: "$_amount" },
                            first: { $min: "$createdAt" },
                            last: { $max: "$createdAt" },
                        },
                    },
                ],
                byMonth: [
                    {
                        $group: {
                            _id: "$_month",
                            orders: { $sum: 1 },
                            pieces: { $sum: "$_pieces" },
                            amount: { $sum: "$_amount" },
                        },
                    },
                    { $sort: { _id: -1 } },
                ],
                companies: [
                    { $group: { _id: { $ifNull: ["$company", ""] }, orders: { $sum: 1 } } },
                    { $sort: { orders: -1, _id: 1 } },
                ],
                topItems: [
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: { $trim: { input: { $toString: { $ifNull: ["$items.item", ""] } } } },
                            quantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
                        },
                    },
                    { $match: { _id: { $ne: "" } } },
                    { $sort: { quantity: -1, _id: 1 } },
                    { $limit: 5 },
                ],
            },
        },
    ]);

    const empty = { orders: 0, pieces: 0, amount: 0 };
    const pick = ({ orders, pieces, amount }) => ({ orders, pieces, amount });
    const byMonth = new Map(result.byMonth.map((m) => [m._id, pick(m)]));
    const lifetime = result.lifetime[0];

    const lastSix = [];
    for (let i = -5; i <= 0; i += 1) {
        const key = monthKey(now, i);
        lastSix.push({ month: key, ...(byMonth.get(key) || empty) });
    }

    return {
        thisMonth: { month: thisMonth, ...(byMonth.get(thisMonth) || empty) },
        lastMonth: { month: lastMonth, ...(byMonth.get(lastMonth) || empty) },
        lifetime: lifetime
            ? { ...pick(lifetime), firstOrder: lifetime.first, lastOrder: lifetime.last }
            : { ...empty, firstOrder: null, lastOrder: null },
        lastSixMonths: lastSix,
        // Months that have orders, newest first, for the month filter.
        months: result.byMonth.map((m) => ({ month: m._id, orders: m.orders })).filter((m) => m.month),
        companies: result.companies.map((c) => ({ name: c._id, orders: c.orders })),
        topItems: result.topItems.map((t) => ({ item: t._id, quantity: t.quantity })),
    };
};

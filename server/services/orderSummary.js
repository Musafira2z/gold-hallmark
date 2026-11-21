// Numbers for the "Today" page, counted on the server so the browser never
// has to download every order. Days and months are in Asia/Dhaka time.
const Order = require("../models/Order");
const User = require("../models/User");
const { monthRange, monthKey } = require("./customerStats");
const { allDues, cashBetween } = require("./balance");

const TZ = "Asia/Dhaka";
const DAY_MS = 24 * 60 * 60 * 1000;
const DHAKA_MS = 6 * 60 * 60 * 1000;

// "2026-11-19" -> { start, end } in Dhaka time. null if not a real date.
const dayRange = (day) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
    if (!match) return null;
    const start = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+06:00`);
    if (isNaN(start.getTime())) return null;
    // Reject dates like 2026-02-31 that Date silently rolls over.
    if (dayKey(start) !== `${match[1]}-${match[2]}-${match[3]}`) return null;
    return { start, end: new Date(start.getTime() + DAY_MS) };
};

// Dhaka calendar day ("2026-11-19") of a date, shifted by `offset` days.
const dayKey = (date, offset = 0) =>
    new Date(date.getTime() + DHAKA_MS + offset * DAY_MS).toISOString().slice(0, 10);

const totals = [
    {
        $group: {
            _id: null,
            orders: { $sum: 1 },
            amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
            hallmark: { $sum: { $cond: [{ $eq: ["$type", "hallmark"] }, 1, 0] } },
            xray: { $sum: { $cond: [{ $eq: ["$type", "xray"] }, 1, 0] } },
        },
    },
];

const getSummary = async (now = new Date()) => {
    const today = dayRange(dayKey(now));
    const month = monthRange(monthKey(now));
    const weekStart = dayRange(dayKey(now, -6)).start;

    const [[result], customers, dues, cashToday] = await Promise.all([
        Order.aggregate([
            { $match: { deletedAt: null, createdAt: { $gte: weekStart < month.start ? weekStart : month.start } } },
            {
                $facet: {
                    today: [{ $match: { createdAt: { $gte: today.start, $lt: today.end } } }, ...totals],
                    month: [{ $match: { createdAt: { $gte: month.start, $lt: month.end } } }, ...totals],
                    week: [
                        { $match: { createdAt: { $gte: weekStart } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
                                orders: { $sum: 1 },
                                amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
                            },
                        },
                    ],
                },
            },
        ]),
        User.countDocuments({ deletedAt: null }),
        allDues(),
        cashBetween(today.start, today.end),
    ]);

    const empty = { orders: 0, amount: 0, hallmark: 0, xray: 0 };
    const clean = (rows) => {
        if (!rows[0]) return { ...empty };
        const { orders, amount, hallmark, xray } = rows[0];
        return { orders, amount, hallmark, xray };
    };
    const byDay = new Map(result.week.map((d) => [d._id, d]));
    const lastSevenDays = [];
    for (let i = -6; i <= 0; i += 1) {
        const key = dayKey(now, i);
        const row = byDay.get(key);
        lastSevenDays.push({ day: key, orders: row ? row.orders : 0, amount: row ? row.amount : 0 });
    }

    return {
        day: dayKey(now),
        month: monthKey(now),
        today: clean(result.today),
        thisMonth: clean(result.month),
        lastSevenDays,
        customers,
        cashToday,
        totalDue: dues.totalDue,
        customersWithDue: dues.customersWithDue,
    };
};

module.exports = { dayRange, dayKey, getSummary };

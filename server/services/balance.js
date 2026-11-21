// Dues (baki) and cash. Plan: plans/11-payments.md
//   customer due = sum(order totals) - sum(paid at order time) - sum(later payments)
// Orders saved before this change have no paidAmount; their memo said "Paid = total",
// so they count as fully paid. Deleted orders and payments are left out.
const Order = require("../models/Order");
const Payment = require("../models/Payment");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const PAID_EXPR = { $ifNull: ["$paidAmount", { $ifNull: ["$totalAmount", 0] }] };

// Balance for one customer.
const customerBalance = async (customerID) => {
    const id = String(customerID);
    const [orders, payments] = await Promise.all([
        Order.aggregate([
            { $match: { customerID: id, deletedAt: null } },
            { $group: { _id: null, billed: { $sum: { $ifNull: ["$totalAmount", 0] } }, paidAtOrder: { $sum: PAID_EXPR } } },
        ]),
        Payment.aggregate([
            { $match: { customerID: id, deletedAt: null } },
            { $group: { _id: null, paid: { $sum: "$amount" } } },
        ]),
    ]);
    const billed = round2(orders[0]?.billed);
    const paidAtOrder = round2(orders[0]?.paidAtOrder);
    const paidLater = round2(payments[0]?.paid);
    return { billed, paidAtOrder, paidLater, due: round2(billed - paidAtOrder - paidLater) };
};

// All customers: total due (advances of one customer do not cancel another's dues).
const allDues = async () => {
    const [orders, payments] = await Promise.all([
        Order.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: "$customerID", owed: { $sum: { $subtract: [{ $ifNull: ["$totalAmount", 0] }, PAID_EXPR] } } } },
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
    let customers = 0;
    due.forEach((v) => {
        if (round2(v) > 0) { total += v; customers += 1; }
    });
    return { totalDue: round2(total), customersWithDue: customers };
};

// Cash taken in a time range: paid at order time + later payments.
const cashBetween = async (start, end) => {
    const [orders, payments] = await Promise.all([
        Order.aggregate([
            { $match: { deletedAt: null, createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: null, cash: { $sum: PAID_EXPR } } },
        ]),
        Payment.aggregate([
            { $match: { deletedAt: null, at: { $gte: start, $lt: end } } },
            { $group: { _id: null, cash: { $sum: "$amount" } } },
        ]),
    ]);
    return round2((orders[0]?.cash || 0) + (payments[0]?.cash || 0));
};

module.exports = { customerBalance, allDues, cashBetween, round2 };

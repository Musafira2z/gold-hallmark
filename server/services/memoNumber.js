// Memo (voucher) numbers: 1000001, 1000002, ... handed out by the server.
// Old memos used random 6-digit numbers (100000-999999, with duplicates),
// so 7-digit numbers can never clash with them (BUGS D2).
const Counter = require("../models/Counter");
const Order = require("../models/Order");

const COUNTER_ID = "voucher";
const START = 1000000; // the first new memo is START + 1

// Next number, safe when two orders are saved at the same moment
// ($inc on one document is atomic in MongoDB).
const nextVoucher = async () => {
    const doc = await Counter.findOneAndUpdate(
        { _id: COUNTER_ID },
        [{ $set: { seq: { $add: [{ $ifNull: ["$seq", START] }, 1] } } }],
        { new: true, upsert: true }
    );
    return doc.seq;
};

// If the counter is missing or behind (e.g. restored from an older backup),
// move it up to the highest new-style memo number already saved.
const syncVoucherCounter = async () => {
    const [top] = await Order.find({ voucher: { $gt: START } }, { voucher: 1 }).sort({ voucher: -1 }).limit(1).lean();
    const highest = top ? top.voucher : START;
    await Counter.updateOne(
        { _id: COUNTER_ID },
        [{ $set: { seq: { $max: [{ $ifNull: ["$seq", START] }, highest] } } }],
        { upsert: true }
    );
};

module.exports = { nextVoucher, syncVoucherCounter, START };

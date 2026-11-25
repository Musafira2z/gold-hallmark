const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({  // Schema for individual items
    item: String,
    quantity: Number,
    rate: Number,
    weight: Number,
    amount: Number,
    weightUnite: String,
    xray: String,       // the Hall Mark text as typed (always kept)
    // Read from `xray` by the server (Plan 15): "22K", "21K", ... or null; and the shop letters.
    purity: String,
    stamp: String,
});

const orderSchema = new mongoose.Schema({
    name: String,
    customerID: String,
    company: String,  // shop name as typed
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" }, // the shop record (Plan 16); null = no shop
    contact: String, // text, so the leading 0 is kept (was Number: BUGS D1)
    address: String,
    items: [itemSchema], // Array of item subdocuments
    type: String,
    voucher: Number,
    totalAmount: Number, // Use totalAmount to avoid confusion
    // Paid when the order was taken (BUGS U13). Missing on old orders = fully paid.
    paidAmount: Number,
    customerFrom: Date,
    image: String,
    // Online report (Plan 14): random link for the QR, and a short code printed on the memo.
    reportToken: String,
    reportCode: String,
    // Status (Plan 15): received -> ready -> delivered. Missing on old orders = delivered.
    status: { type: String, enum: ["received", "ready", "delivered"] },
    readyAt: Date,
    deliveredAt: Date,
    statusBy: String,
    parseV: Number, // version of the Hall Mark reader used for purity/stamp
    // Order edits (BUGS F1): when it was last edited, and what it looked like before each edit.
    editedAt: Date,
    // "Deleted" orders stay in the database (BUGS U7): hidden from lists and totals.
    deletedAt: Date,
    deletedBy: String,
    edits: [{
        _id: false,
        at: Date,
        company: String,
        totalAmount: Number,
        items: [itemSchema],
    }],
}, { timestamps: true });

// Indexes only speed up lookups; they do not change any stored data.
orderSchema.index({ customerID: 1, createdAt: -1 }); // customer profile / history
orderSchema.index({ createdAt: -1 });                // day summary, newest first
orderSchema.index({ shopId: 1, createdAt: -1 });     // a shop's orders
orderSchema.index({ status: 1, createdAt: -1 });     // "waiting for pickup"
orderSchema.index({ updatedAt: 1, _id: 1 });         // online sync: what changed since last time
orderSchema.index({ reportToken: 1 }, { unique: true, partialFilterExpression: { reportToken: { $type: "string" } } });
// New memo numbers (1000001+) must be unique. Old random 6-digit numbers
// have duplicates and are left as they are.
orderSchema.index({ voucher: 1 }, { unique: true, partialFilterExpression: { voucher: { $gt: 1000000 } } });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
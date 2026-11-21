const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({  // Schema for individual items
    item: String,
    quantity: Number,
    rate: Number,
    weight: Number,
    amount: Number,
    weightUnite: String,
    xray: String,
});

const orderSchema = new mongoose.Schema({
    name: String,
    customerID: String,
    company: String,
    contact: String, // text, so the leading 0 is kept (was Number: BUGS D1)
    address: String,
    items: [itemSchema], // Array of item subdocuments
    type: String,
    voucher: Number,
    totalAmount: Number, // Use totalAmount to avoid confusion
    customerFrom: Date,
    image: String,
    // Order edits (BUGS F1): when it was last edited, and what it looked like before each edit.
    editedAt: Date,
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
// New memo numbers (1000001+) must be unique. Old random 6-digit numbers
// have duplicates and are left as they are.
orderSchema.index({ voucher: 1 }, { unique: true, partialFilterExpression: { voucher: { $gt: 1000000 } } });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
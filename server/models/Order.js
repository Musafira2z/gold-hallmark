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
    contact: Number,
    address: String,
    items: [itemSchema], // Array of item subdocuments
    type: String,
    voucher: Number,
    totalAmount: Number, // Use totalAmount to avoid confusion
    customerFrom: Date,
    image: String,
}, { timestamps: true });

// Indexes only speed up lookups; they do not change any stored data.
orderSchema.index({ customerID: 1, createdAt: -1 }); // customer profile / history
orderSchema.index({ createdAt: -1 });                // day summary, newest first

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({  // Schema for individual items
    item: String,
    quantity: Number,
    rate: Number,
    weight: Number,
    amount: Number,
    weightUnite: String,
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
    xray: String,
    customerFrom: Date,
    image: String,
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
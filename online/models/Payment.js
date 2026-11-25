const mongoose = require("mongoose");

// A later payment against a customer's dues (baki), copied from the shop PC (Plan 18).
const paymentSchema = new mongoose.Schema({
    shopPaymentId: { type: String, required: true, unique: true },
    customerID: { type: String, required: true, index: true },
    amount: Number,
    at: Date,
    deletedAt: Date,
    syncedAt: Date,
}, { versionKey: false });

module.exports = mongoose.model("Payment", paymentSchema);

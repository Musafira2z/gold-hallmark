const mongoose = require("mongoose");

// Money a customer pays later, against their dues (baki). Not tied to one order.
const paymentSchema = new mongoose.Schema({
    customerID: { type: String, required: true, index: true }, // same text form as on orders
    amount: { type: Number, required: true },
    note: String,
    at: { type: Date, default: Date.now, index: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    staffName: String,
    // A wrong entry is hidden, never removed (owner only).
    deletedAt: Date,
    deletedBy: String,
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);

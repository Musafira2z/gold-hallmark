const mongoose = require("mongoose");

// One test report = one order from the shop, copied here by the sync.
// Only what the public report needs: no phone, bill, payments or dues.
const itemSchema = new mongoose.Schema({
    item: String,
    quantity: Number,
    weight: Number,
    weightUnite: String,
    xray: String, // the result text
}, { _id: false });

const reportSchema = new mongoose.Schema({
    shopOrderId: { type: String, required: true, unique: true }, // the order's _id on the shop PC
    reportToken: { type: String, required: true, unique: true },
    reportCode: { type: String, required: true },
    voucher: Number,
    type: String,
    company: String,
    orderedAt: Date,       // order's createdAt on the shop PC
    shopUpdatedAt: Date,   // order's updatedAt on the shop PC
    editedAt: Date,
    deletedAt: Date,
    items: [itemSchema],
    syncedAt: Date,
}, { versionKey: false });

reportSchema.index({ voucher: 1, reportCode: 1 });

module.exports = mongoose.model("Report", reportSchema);

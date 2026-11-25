const mongoose = require("mongoose");

// One test report = one order from the shop, copied here by the sync.
// The public report page shows only the test. customerID, shopId, broughtBy, total and paid
// are for the logged-in portal (Plan 18) and never appear on the public page. No phone.
const itemSchema = new mongoose.Schema({
    item: String,
    quantity: Number,
    weight: Number,
    weightUnite: String,
    xray: String,   // the Hall Mark text as typed at the shop
    purity: String, // "22K", "21K", ... read from it (null if unclear)
    stamp: String,  // the shop letters in the mark
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
    status: String,  // received | ready | delivered
    readyAt: Date,
    items: [itemSchema],
    customerID: String,  // who brought it (portal: "my tests", dues)
    shopId: String,      // shop record on the PC (portal: shop owner's shops)
    broughtBy: String,   // name of who brought it (shown to the shop owner)
    total: Number,       // bill (portal, own orders only)
    paid: Number,        // paid at the counter
    syncedAt: Date,
}, { versionKey: false });

reportSchema.index({ voucher: 1, reportCode: 1 });
reportSchema.index({ customerID: 1, orderedAt: -1 });
reportSchema.index({ shopId: 1, orderedAt: -1 });

module.exports = mongoose.model("Report", reportSchema);

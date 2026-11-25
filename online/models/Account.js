const mongoose = require("mongoose");

// A karigor's or shop owner's online login (Plan 18), copied from the shop PC by the sync.
// No PIN, only its scrypt hash. pinHash null = login off.
const accountSchema = new mongoose.Schema({
    shopUserId: { type: String, required: true, unique: true }, // the customer's _id on the shop PC
    customerID: { type: String, required: true, index: true },
    name: String,
    phone: { type: String, index: true },
    kind: String,           // shop_owner | karigor | other | ""
    pinHash: String,
    pinSetAt: Date,         // sessions made before this are no longer valid (new PIN = log out everywhere)
    shops: [{ _id: false, id: String, name: String }],
    syncedAt: Date,
}, { versionKey: false });

module.exports = mongoose.model("Account", accountSchema);

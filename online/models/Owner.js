const mongoose = require("mongoose");

// The owner's phone app login (Plan 19), copied from the shop PC. Only a salted hash of the code.
// codeHash null = off. Sessions made before codeSetAt are no longer valid.
const ownerSchema = new mongoose.Schema({
    shopStaffId: { type: String, required: true, unique: true },
    name: String,
    codeHash: String,
    codeSetAt: Date,
    syncedAt: Date,
}, { versionKey: false });

module.exports = mongoose.model("Owner", ownerSchema);

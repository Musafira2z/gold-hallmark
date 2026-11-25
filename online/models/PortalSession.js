const mongoose = require("mongoose");

// A logged-in phone (Plan 18). The cookie holds a random token; only its sha256 is kept here.
const sessionSchema = new mongoose.Schema({
    _id: String,            // sha256 of the cookie token
    account: { type: String, required: true, index: true }, // Account.shopUserId
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
}, { versionKey: false });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB removes old sessions

module.exports = mongoose.model("PortalSession", sessionSchema);

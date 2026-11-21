const mongoose = require("mongoose");

// One login. Only a hash of the token is stored, never the token itself.
const sessionSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true, index: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// MongoDB removes expired sessions by itself.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", sessionSchema);

const mongoose = require("mongoose");

// People who use the app (owner and staff). Customers are in `users`, not here.
const staffSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["owner", "staff"], default: "staff" },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
    // Owner's phone app (Plan 19): only a salted hash of the code; never sent to the browser.
    ownerAppCodeHash: { type: String, select: false },
    ownerAppCodeSetAt: Date, // when the current code was made (also: "has had a code")
    ownerAppOffAt: Date,     // turned off
}, { timestamps: true });

module.exports = mongoose.model("Staff", staffSchema);

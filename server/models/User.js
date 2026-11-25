const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
        customerID: Number,
        name: String,
        contact: String, // Changed to String to preserve leading zeros
        company: [String],
        address: String,
        image: String,
        // Customer type (Plan 16), chosen by staff. Missing = not set yet.
        kind: { type: String, enum: ["shop_owner", "karigor", "other"] },
        // Online login for the portal (Plan 18). Only a scrypt hash of the PIN is kept,
        // and it is never sent to the browser (select: false).
        portalPinHash: { type: String, select: false },
        portalPinSetAt: Date,   // when the current PIN was made (also: "has had a login")
        portalOffAt: Date,      // login turned off
        portalShops: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shop" }], // shop owner: their shops
        // "Deleted" customers stay in the database (BUGS U7): hidden from lists.
        deletedAt: Date,
        deletedBy: String,
    },
    {timestamps: true});

const User = mongoose.model("User", userSchema);

module.exports = User;

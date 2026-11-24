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
        // "Deleted" customers stay in the database (BUGS U7): hidden from lists.
        deletedAt: Date,
        deletedBy: String,
    },
    {timestamps: true});

const User = mongoose.model("User", userSchema);

module.exports = User;

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
        customerID: Number,
        name: String,
        contact: String, // Changed to String to preserve leading zeros
        company: [String],
        address: String,
        image: String,
        // "Deleted" customers stay in the database (BUGS U7): hidden from lists.
        deletedAt: Date,
        deletedBy: String,
    },
    {timestamps: true});

const User = mongoose.model("User", userSchema);

module.exports = User;

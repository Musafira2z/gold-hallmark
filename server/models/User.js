const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
        customerID: Number,
        name: String,
        contact: String, // Changed to String to preserve leading zeros
        company: [String],
        address: String,
        image: String
    },
    {timestamps: true});

const User = mongoose.model("User", userSchema);

module.exports = User;

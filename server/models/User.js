const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
        customerID: Number,
        name: String,
        contact: Number,
        company: [String],
        address: String,
        image: String
    },
    {timestamps: true});

const User = mongoose.model("User", userSchema);

module.exports = User;

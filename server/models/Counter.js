const mongoose = require("mongoose");

// Running numbers (e.g. the next memo number). One document per counter.
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: Number,
});

module.exports = mongoose.model("Counter", counterSchema);

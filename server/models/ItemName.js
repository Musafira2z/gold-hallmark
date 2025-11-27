const mongoose = require("mongoose");

const allowedTypes = ["hallmark", "xray"];

const itemNameSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 120
    },
    type: {
        type: String,
        required: true,
        enum: allowedTypes
    },
    normalized: {
        type: String,
        required: true
    }
}, { timestamps: true });

itemNameSchema.index({ type: 1, normalized: 1 }, { unique: true });

itemNameSchema.pre("validate", function setNormalized(next) {
    if (this.name) {
        this.name = this.name.replace(/\s+/g, " ").trim();
        this.normalized = this.name.toLowerCase();
    }
    next();
});

module.exports = mongoose.model("ItemName", itemNameSchema);


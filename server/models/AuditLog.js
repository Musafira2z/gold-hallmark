const mongoose = require("mongoose");

// Who did what, and when. Written by the server; never edited.
const auditLogSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now, index: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    staffName: String,
    action: { type: String, required: true }, // e.g. "order.delete"
    target: String,                            // e.g. the order or customer id
    summary: String,                           // short human text
});

module.exports = mongoose.model("AuditLog", auditLogSchema, "auditlog");

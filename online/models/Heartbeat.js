const mongoose = require("mongoose");

// The shop PC's last heartbeat (Plan 19). One document, _id "pc".
// receivedAt is this server's clock (the PC's clock may be wrong).
const heartbeatSchema = new mongoose.Schema({
    _id: String,
    at: Date,          // PC's clock
    receivedAt: Date,  // our clock
    version: String,
    waiting: Number,   // records not sent yet
    backup: { _id: false, name: String, at: Date, size: Number },
}, { versionKey: false });

module.exports = mongoose.model("Heartbeat", heartbeatSchema);

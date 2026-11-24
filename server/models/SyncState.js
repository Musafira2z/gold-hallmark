const mongoose = require("mongoose");

// How far the online sync has got (Plan 14 / S1). One document per kind of data.
const syncStateSchema = new mongoose.Schema({
    _id: String,            // e.g. "orders"
    cursorAt: Date,         // updatedAt of the last record the website accepted
    cursorId: mongoose.Schema.Types.ObjectId, // its _id (several records can share a time)
    lastOkAt: Date,         // last time a send worked (or there was nothing to send)
    lastTryAt: Date,
    lastError: String,      // empty when the last try worked
    sent: { type: Number, default: 0 }, // total records accepted so far
});

module.exports = mongoose.model("SyncState", syncStateSchema);

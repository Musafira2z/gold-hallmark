const mongoose = require("mongoose");

// One record per shop (Plan 16). Orders keep the shop name as typed; `shopId` on the
// order points here. `keys` are the cleaned spellings that mean this shop, so a new
// order typed "AL-MODINA JEWELLERS." finds the same shop as "AL MODINA JEWELLERS".
const shopSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    keys: { type: [String], default: [] },
}, { timestamps: true });

// A spelling can belong to one shop only.
shopSchema.index({ keys: 1 }, { unique: true });

module.exports = mongoose.model("Shop", shopSchema);

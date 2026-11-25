// Shop records (Plan 16): build them from old data, find the shop for a typed name,
// list, rename and merge.
const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const Order = require("../models/Order");
const User = require("../models/User");
const { shopKey, tidyName } = require("./shopName");

const isDuplicateKey = (error) => error && error.code === 11000;

// Shop id for a typed name, creating the shop when it is new. null = no shop.
const resolveShop = async (company) => {
    const key = shopKey(company);
    if (!key) return null;
    const found = await Shop.findOne({ keys: key }, { _id: 1 }).lean();
    if (found) return found._id;
    try {
        const created = await Shop.create({ name: tidyName(company), keys: [key] });
        return created._id;
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const again = await Shop.findOne({ keys: key }, { _id: 1 }).lean(); // saved at the same moment
        return again ? again._id : null;
    }
};

// Old data: one shop per key (name = most used spelling), then shopId on every order.
// Orders' updatedAt is left alone. Safe to run on every start.
const ensureShops = async () => {
    const pending = await Order.countDocuments({ shopId: { $exists: false } });
    const [orderNames, customerNames] = await Promise.all([
        pending > 0 ? Order.aggregate([{ $group: { _id: "$company", n: { $sum: 1 } } }]) : [],
        pending > 0 ? User.aggregate([{ $unwind: "$company" }, { $group: { _id: "$company", n: { $sum: 1 } } }]) : [],
    ]);
    if (pending === 0) return { created: 0, orders: 0 };

    // key -> { spelling -> uses }
    const byKey = new Map();
    const add = (raw, n) => {
        const key = shopKey(raw);
        if (!key) return;
        const spellings = byKey.get(key) || new Map();
        const tidy = tidyName(raw);
        spellings.set(tidy, (spellings.get(tidy) || 0) + n);
        byKey.set(key, spellings);
    };
    orderNames.forEach((r) => add(r._id, r.n * 1000)); // order spellings win over customer-list spellings
    customerNames.forEach((r) => add(r._id, r.n));

    const existing = new Set((await Shop.find({}, { keys: 1 }).lean()).flatMap((s) => s.keys));
    const toCreate = [];
    for (const [key, spellings] of byKey) {
        if (existing.has(key)) continue;
        const name = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        toCreate.push({ name, keys: [key] });
    }
    if (toCreate.length) await Shop.insertMany(toCreate, { ordered: false });

    const idByKey = new Map();
    (await Shop.find({}, { keys: 1 }).lean()).forEach((s) => s.keys.forEach((k) => idByKey.set(k, s._id)));
    // Link orders in batches by _id (fast: no scan per shop name).
    for (;;) {
        const batch = await Order.find({ shopId: { $exists: false } }, { company: 1 }).limit(2000).lean();
        if (batch.length === 0) break;
        await Order.bulkWrite(
            batch.map((o) => ({
                updateOne: {
                    filter: { _id: o._id },
                    update: { $set: { shopId: idByKey.get(shopKey(o.company)) || null } },
                    timestamps: false,
                },
            })),
            { ordered: false, timestamps: false }
        );
    }
    return { created: toCreate.length, orders: pending };
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Shops with numbers, most orders first. q searches the name.
const listShops = async ({ q = "", page = 1, limit = 50 } = {}) => {
    const [shops, stats, spellings] = await Promise.all([
        Shop.find({}, { name: 1 }).lean(),
        Order.aggregate([
            { $match: { deletedAt: null, shopId: { $ne: null } } },
            { $group: { _id: "$shopId", orders: { $sum: 1 }, customers: { $addToSet: "$customerID" }, last: { $max: "$createdAt" } } },
            { $project: { orders: 1, customers: { $size: "$customers" }, last: 1 } },
        ]),
        Order.aggregate([
            { $match: { shopId: { $ne: null } } },
            { $group: { _id: { s: "$shopId", c: "$company" } } },
            { $group: { _id: "$_id.s", names: { $push: "$_id.c" } } },
        ]),
    ]);
    const statBy = new Map(stats.map((s) => [String(s._id), s]));
    const namesBy = new Map(spellings.map((s) => [String(s._id), s.names]));
    const text = String(q || "").trim();
    const re = text ? new RegExp(escapeRegex(text), "i") : null;
    const rows = shops
        .map((s) => {
            const st = statBy.get(String(s._id)) || { orders: 0, customers: 0, last: null };
            // Other ways the name was typed (only ones that look different on screen).
            const typed = [...new Set((namesBy.get(String(s._id)) || []).map(tidyName))].filter((n) => n && n !== s.name);
            return { _id: s._id, name: s.name, orders: st.orders, customers: st.customers, lastOrder: st.last, spellings: typed.sort() };
        })
        .filter((s) => !re || re.test(s.name) || s.spellings.some((n) => re.test(n)))
        .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));
    const total = rows.length;
    const start = (page - 1) * limit;
    return { shops: rows.slice(start, start + limit), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
};

const validId = (id) => mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(String(id));

// Rename. The new spelling also finds this shop from now on.
const renameShop = async (id, name) => {
    if (!validId(id)) return null;
    const clean = tidyName(name);
    if (clean.length < 2) return { error: "Write the shop name (at least 2 letters)." };
    const key = shopKey(clean);
    if (!key) return { error: "That is not a shop name." };
    const shop = await Shop.findById(id);
    if (!shop) return null;
    const other = await Shop.findOne({ keys: key, _id: { $ne: shop._id } }, { name: 1 }).lean();
    if (other) return { error: `"${other.name}" already has this name. Merge the two shops instead.` };
    const before = shop.name;
    shop.name = clean;
    if (!shop.keys.includes(key)) shop.keys.push(key);
    await shop.save();
    // The website shows the shop name: send these orders again.
    await Order.updateMany({ shopId: shop._id }, { $currentDate: { updatedAt: true } }, { timestamps: false });
    await User.updateMany({ portalShops: shop._id }, { $currentDate: { updatedAt: true } }, { timestamps: false }); // portal shop name
    return { shop, before };
};

// Merge `dropId` into `keepId`: orders move, spellings move, the dropped record goes.
const mergeShops = async (keepId, dropId) => {
    if (!validId(keepId) || !validId(dropId)) return null;
    if (String(keepId) === String(dropId)) return { error: "Choose two different shops." };
    const [keep, drop] = await Promise.all([Shop.findById(keepId), Shop.findById(dropId)]);
    if (!keep || !drop) return null;
    const keys = drop.keys;
    await Shop.updateOne({ _id: drop._id }, { $set: { keys: [] } });        // free the spellings first (unique)
    await Shop.updateOne({ _id: keep._id }, { $addToSet: { keys: { $each: keys } } });
    const moved = await Order.updateMany({ shopId: drop._id }, { $set: { shopId: keep._id } }); // updatedAt changes: re-sync
    // Shop owners who had the dropped shop ticked now have the kept one (Plan 18).
    await User.updateMany({ portalShops: drop._id }, { $addToSet: { portalShops: keep._id } });
    await User.updateMany({ portalShops: drop._id }, { $pull: { portalShops: drop._id } });
    await Shop.deleteOne({ _id: drop._id });
    return { keep: await Shop.findById(keep._id).lean(), dropName: drop.name, moved: moved.modifiedCount };
};

module.exports = { resolveShop, ensureShops, listShops, renameShop, mergeShops, validId };

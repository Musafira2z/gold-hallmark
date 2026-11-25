#!/usr/bin/env node
// Migration 17: fix old order data (BUGS D5, D6, D7, D13). Plan: plans/17-s2c-data-fixes.md
//
//   node migrations/17-data-fixes.js --dry-run   show what would change (default, changes nothing)
//   node migrations/17-data-fixes.js --apply     make the changes, logging every old value
//   node migrations/17-data-fixes.js --undo      put every logged value back
//
// What it changes:
//   D5   orders with no memo number (the setup tests of 31 Dec 2024 – 4 Jan 2025) -> Deleted
//        (hidden, not erased: the owner can restore them under Orders -> Deleted)
//   D13  an item kept at the top of an order (old shape) -> moved into the `items` list
//   D6   orders with no type -> "hallmark" (98.6% of orders are Hallmark; the rates match)
//   D7   customer IDs used by orders but with no customer record -> customer recreated
//        from their latest order (name, phone, shop, address)
// Orders with a memo number but no items (0 taka) are left as they are.
//
// Every change is written to `migration_log` first. Running --apply again changes nothing.
// --undo only puts back a value that still holds what this migration wrote, so later edits
// by staff are never overwritten. Changed orders get a new updatedAt so the online copy follows.

require("dotenv").config();
const mongoose = require("mongoose");
const { fixPhone } = require("../utils/phone");

const MIGRATION = "17-data-fixes";
const BY = "Data cleanup (plan 17)";
const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--undo") ? "undo" : "dry-run";

const NO_VOUCHER = { $or: [{ voucher: null }, { voucher: "" }] };
const TOP_ITEM_FIELDS = ["item", "quantity", "weight", "weightUnite", "rate", "amount", "xray"];
const hasText = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const num = (v) => (v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

// One change to one order: { _id, set: {field: new}, unset: [field], before: {field: old}, missing: [field] }
// `before` holds the old values of fields that were there; `missing` lists the ones that weren't.
const planOrders = async (db) => {
    const orders = db.collection("orders");
    const changes = new Map();
    const change = (doc) => {
        if (!changes.has(String(doc._id))) changes.set(String(doc._id), { _id: doc._id, set: {}, unset: [], before: {}, missing: [] });
        return changes.get(String(doc._id));
    };
    const remember = (c, doc, f) => {
        if (f in c.before || c.missing.includes(f)) return;
        if (doc[f] === undefined) c.missing.push(f); else c.before[f] = doc[f];
    };
    const count = { deleted: 0, moved: 0, typed: 0 };

    // D5 + D13: setup-test orders with no memo number.
    for (const doc of await orders.find({ ...NO_VOUCHER }).toArray()) {
        const c = change(doc);
        if (!doc.deletedAt) {
            remember(c, doc, "deletedAt");
            remember(c, doc, "deletedBy");
            c.set.deletedAt = doc.createdAt || new Date();
            c.set.deletedBy = BY;
            count.deleted += 1;
        }
        const noList = !Array.isArray(doc.items) || doc.items.length === 0;
        if (noList && hasText(doc.item)) {
            const quantity = num(doc.quantity);
            const rate = num(doc.rate);
            remember(c, doc, "items");
            c.set.items = [{
                item: String(doc.item).trim(),
                quantity,
                weight: num(doc.weight),
                weightUnite: doc.weightUnite || "gm",
                rate,
                amount: num(doc.amount) ?? (quantity !== null && rate !== null ? quantity * rate : null),
                xray: hasText(doc.xray) ? String(doc.xray) : "",
            }];
            TOP_ITEM_FIELDS.forEach((f) => {
                if (doc[f] !== undefined) {
                    remember(c, doc, f);
                    c.unset.push(f);
                }
            });
            count.moved += 1;
        }
    }

    // D6: orders with no type (the setup tests above are left without one).
    for (const doc of await orders.find({ voucher: { $nin: [null, ""] }, $or: [{ type: null }, { type: "" }] }, { projection: { type: 1 } }).toArray()) {
        const c = change(doc);
        remember(c, doc, "type");
        c.set.type = "hallmark";
        count.typed += 1;
    }

    const list = [...changes.values()].filter((c) => Object.keys(c.set).length || c.unset.length);
    console.log(`orders: ${count.deleted} setup tests to move to Deleted, ${count.moved} top-level items to move into the list, ${count.typed} with no type -> Hallmark`);
    const empty = await orders.countDocuments({ voucher: { $ne: null }, $or: [{ items: { $exists: false } }, { items: { $size: 0 } }] });
    console.log(`orders with a memo number but no items: ${empty} (left as they are)`);
    return list;
};

// D7: customer records for customer IDs that orders use.
const planCustomers = async (db) => {
    const known = new Set((await db.collection("users").distinct("customerID")).map((id) => String(id)));
    const groups = await db.collection("orders").aggregate([
        { $match: { customerID: { $nin: [null, ""] } } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: "$customerID", first: { $first: "$createdAt" }, last: { $last: "$$ROOT" }, orders: { $sum: 1 } } },
    ]).toArray();
    const missing = groups.filter((g) => !known.has(String(g._id)) && Number.isSafeInteger(Number(g._id)) && Number(g._id) > 0);
    const docs = missing.map((g) => {
        const o = g.last;
        const company = hasText(o.company) ? [String(o.company).trim()] : [];
        return {
            _id: new mongoose.Types.ObjectId(),
            customerID: Number(g._id),
            name: hasText(o.name) ? String(o.name).trim() : "",
            contact: fixPhone(o.contact) || (hasText(o.contact) ? String(o.contact).trim() : ""),
            company,
            address: hasText(o.address) ? String(o.address).trim() : "",
            image: null,
            createdAt: g.first || new Date(),
            updatedAt: new Date(),
            __v: 0,
        };
    });
    console.log(`customers: ${docs.length} to recreate${docs.length ? ": " + missing.map((g) => `${g._id} ${g.last.name || ""} (${g.orders} orders)`).join(", ") : ""}`);
    return docs;
};

const applyOrders = async (db, list) => {
    if (!list.length) return 0;
    const at = new Date();
    await db.collection("migration_log").insertMany(list.map((c) => ({
        migration: MIGRATION, action: "update", collection: "orders", docId: c._id,
        before: c.before, missing: c.missing, set: c.set, unset: c.unset, at,
    })));
    let done = 0;
    for (const c of list) {
        // Only if each field still holds its old value (nothing changed meanwhile).
        const filter = { _id: c._id };
        Object.entries(c.before).forEach(([f, v]) => { filter[f] = v; });
        c.missing.forEach((f) => { filter[f] = { $exists: false }; });
        const update = { $set: { ...c.set, updatedAt: at } };
        if (c.unset.length) update.$unset = Object.fromEntries(c.unset.map((f) => [f, 1]));
        const r = await db.collection("orders").updateOne(filter, update);
        done += r.modifiedCount;
    }
    return done;
};

const applyCustomers = async (db, docs) => {
    if (!docs.length) return 0;
    const at = new Date();
    await db.collection("migration_log").insertMany(docs.map((d) => ({
        migration: MIGRATION, action: "insert", collection: "users", docId: d._id, new: d, at,
    })));
    const r = await db.collection("users").insertMany(docs);
    return r.insertedCount;
};

const undo = async (db) => {
    const log = db.collection("migration_log");
    const entries = await log.find({ migration: MIGRATION, undoneAt: { $exists: false } }).sort({ _id: -1 }).toArray();
    let restored = 0;
    let skipped = 0;
    const at = new Date();
    for (const e of entries) {
        if (e.action === "update") {
            // Still as this migration left it?
            const filter = { _id: e.docId, ...e.set };
            (e.unset || []).forEach((f) => { filter[f] = { $exists: false }; });
            const set = { ...e.before, updatedAt: at };
            const unset = Object.fromEntries((e.missing || []).map((f) => [f, 1]));
            const update = { $set: set };
            if (Object.keys(unset).length) update.$unset = unset;
            const r = await db.collection("orders").updateOne(filter, update);
            if (r.modifiedCount) restored += 1; else skipped += 1;
        } else if (e.action === "insert") {
            // Only remove the customer if nobody changed it since.
            const r = await db.collection("users").deleteOne({ _id: e.docId, updatedAt: e.new.updatedAt });
            if (r.deletedCount) restored += 1; else skipped += 1;
        }
        await log.updateOne({ _id: e._id }, { $set: { undoneAt: at } });
    }
    console.log(`undo: ${restored} put back, ${skipped} skipped (changed again since, or already back)`);
};

const main = async () => {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    console.log(`Migration ${MIGRATION} — mode: ${mode} — database: ${db.databaseName}`);

    if (mode === "undo") {
        await undo(db);
        return;
    }

    const orders = await planOrders(db);
    const customers = await planCustomers(db);

    if (mode === "dry-run") {
        console.log("dry-run: nothing was changed. Run with --apply to make these changes.");
        return;
    }

    const o = await applyOrders(db, orders);
    const c = await applyCustomers(db, customers);
    console.log(`applied: ${o} orders changed, ${c} customers recreated. Old values are in migration_log.`);
};

main()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
        console.error("Migration failed:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    });

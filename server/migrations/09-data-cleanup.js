#!/usr/bin/env node
// Migration 09: clean old data (BUGS D1, D11, D10). Plan: plans/09-data-cleanup.md
//
//   node migrations/09-data-cleanup.js --dry-run   show what would change (default, changes nothing)
//   node migrations/09-data-cleanup.js --apply     make the changes, logging every old value
//   node migrations/09-data-cleanup.js --undo      put every logged value back
//
// What it changes:
//   users.contact   1725275114 -> "01725275114"  (10-digit numbers starting with 1)
//   orders.contact  same rule
//   itemnames       removes names that are only a number ("2", "220"); orders are not touched
// Everything else (odd phones, missing phones, orders using those item names) is left as is
// and listed so the owner can check it.
//
// Every change is written to the `migration_log` collection first (collection, _id, old, new).
// Running --apply again changes nothing. --undo only restores a value that still holds what
// this migration wrote, so later edits by staff are never overwritten.

require("dotenv").config();
const mongoose = require("mongoose");
const { fixPhone } = require("../utils/phone");

const MIGRATION = "09-data-cleanup";
const BATCH = 1000;
const isNumberLike = (text) => /^\s*\d+([.,]\d+)?\s*$/.test(String(text ?? ""));

const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--undo") ? "undo" : "dry-run";

const planPhones = async (db, collection, label) => {
    const changes = [];
    const odd = [];
    let ok = 0;
    let missing = 0;
    const cursor = db.collection(collection).find({}, { projection: { contact: 1, customerID: 1 } });
    for await (const doc of cursor) {
        const value = doc.contact;
        if (value === null || value === undefined || String(value).trim() === "") { missing += 1; continue; }
        const fixed = fixPhone(value);
        if (fixed) changes.push({ _id: doc._id, old: value, new: fixed });
        else if (/^0\d{10}$/.test(String(value)) && typeof value === "string") ok += 1;
        else odd.push({ _id: doc._id, customerID: doc.customerID, contact: value });
    }
    console.log(`${label}: ${changes.length} to fix, ${ok} already fine, ${missing} empty, ${odd.length} odd (left alone)`);
    return { changes, odd };
};

const planItemNames = async (db) => {
    const remove = await db.collection("itemnames").find({}).toArray().then((all) => all.filter((i) => isNumberLike(i.name)));
    const names = remove.map((i) => i.name);
    const ordersUsing = names.length ? await db.collection("orders").countDocuments({ "items.item": { $in: names } }) : 0;
    console.log(`item names: ${remove.length} number-only names to remove (${names.join(", ") || "-"}); ${ordersUsing} orders use them and are NOT changed`);
    return remove;
};

const applyPhoneChanges = async (db, collection, changes) => {
    let done = 0;
    for (let i = 0; i < changes.length; i += BATCH) {
        const batch = changes.slice(i, i + BATCH);
        const at = new Date();
        await db.collection("migration_log").insertMany(
            batch.map((c) => ({ migration: MIGRATION, action: "set", collection, docId: c._id, field: "contact", old: c.old, new: c.new, at }))
        );
        // The filter includes the old value, so a record changed meanwhile is skipped.
        const result = await db.collection(collection).bulkWrite(
            batch.map((c) => ({ updateOne: { filter: { _id: c._id, contact: c.old }, update: { $set: { contact: c.new } } } })),
            { ordered: false }
        );
        done += result.modifiedCount;
    }
    return done;
};

const applyItemRemovals = async (db, items) => {
    if (items.length === 0) return 0;
    const at = new Date();
    await db.collection("migration_log").insertMany(
        items.map((doc) => ({ migration: MIGRATION, action: "delete", collection: "itemnames", docId: doc._id, old: doc, at }))
    );
    const result = await db.collection("itemnames").deleteMany({ _id: { $in: items.map((i) => i._id) } });
    return result.deletedCount;
};

const undo = async (db) => {
    const log = db.collection("migration_log");
    const entries = await log.find({ migration: MIGRATION, undoneAt: { $exists: false } }).toArray();
    let restored = 0;
    let skipped = 0;
    for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH);
        for (const e of batch) {
            if (e.action === "set") {
                const r = await db.collection(e.collection).updateOne({ _id: e.docId, [e.field]: e.new }, { $set: { [e.field]: e.old } });
                if (r.modifiedCount) restored += 1; else skipped += 1;
            } else if (e.action === "delete") {
                const exists = await db.collection(e.collection).countDocuments({ _id: e.docId });
                if (exists) { skipped += 1; continue; }
                await db.collection(e.collection).insertOne(e.old);
                restored += 1;
            }
        }
        await log.updateMany({ _id: { $in: batch.map((e) => e._id) } }, { $set: { undoneAt: new Date() } });
    }
    console.log(`undo: ${restored} restored, ${skipped} skipped (changed again since, or already back)`);
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

    const users = await planPhones(db, "users", "customer phones");
    const orders = await planPhones(db, "orders", "order phones");
    const items = await planItemNames(db);
    if (users.odd.length) {
        console.log("customers with odd phones (owner should check):");
        users.odd.forEach((u) => console.log(`  customer ${u.customerID}: ${u.contact}`));
    }

    if (mode === "dry-run") {
        console.log("dry-run: nothing was changed. Run with --apply to make these changes.");
        return;
    }

    const u = await applyPhoneChanges(db, "users", users.changes);
    const o = await applyPhoneChanges(db, "orders", orders.changes);
    const r = await applyItemRemovals(db, items);
    console.log(`applied: ${u} customer phones, ${o} order phones, ${r} item names removed. Old values are in migration_log.`);
};

main()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
        console.error("Migration failed:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    });

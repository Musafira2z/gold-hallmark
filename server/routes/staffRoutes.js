// Owner only: staff accounts and the activity log.
const express = require("express");
const mongoose = require("mongoose");
const Staff = require("../models/Staff");
const AuditLog = require("../models/AuditLog");
const auth = require("../services/authService");
const { audit } = require("../services/audit");
const { makeCode, hashCode } = require("../services/ownerCode");

const router = express.Router();

router.get("/staff", async (_req, res) => {
    try {
        const list = await Staff.find({}).sort({ role: 1, name: 1 });
        res.json(list.map(auth.publicStaff));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not load accounts" });
    }
});

router.post("/staff", async (req, res) => {
    try {
        const { name, username, password, role = "staff" } = req.body || {};
        const problem = auth.checkAccountInput({ name, username, password, role }, { passwordRequired: true });
        if (problem) return res.status(400).json({ error: problem });
        const staff = await Staff.create({
            name: name.trim(),
            username: username.trim().toLowerCase(),
            passwordHash: await auth.hashPassword(password),
            role,
        });
        await audit(req, "staff.create", staff._id, `Added ${role} ${staff.username} (${staff.name})`);
        res.status(201).json(auth.publicStaff(staff));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: "This username is taken." });
        console.error(error);
        res.status(500).json({ error: "Could not add the account" });
    }
});

// Change name, role, active, or set a new password. Switching an account off
// or changing its password logs it out everywhere at once.
router.put("/staff/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Account not found" });
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json({ error: "Account not found" });
        const { name, role, active, password } = req.body || {};
        const problem = auth.checkAccountInput({ name, role, password }, { passwordRequired: false });
        if (problem) return res.status(400).json({ error: problem });
        if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ error: "Invalid active value." });

        // Never leave the shop without an active owner.
        const losesOwner = staff.role === "owner" && ((role && role !== "owner") || active === false);
        if (losesOwner) {
            const owners = await Staff.countDocuments({ role: "owner", active: true });
            if (owners <= 1) return res.status(400).json({ error: "There must always be one active owner." });
        }

        const changes = [];
        if (name !== undefined && name.trim() !== staff.name) { staff.name = name.trim(); changes.push("name"); }
        if (role !== undefined && role !== staff.role) { staff.role = role; changes.push(`role → ${role}`); }
        if (active !== undefined && active !== staff.active) { staff.active = active; changes.push(active ? "switched on" : "switched off"); }
        if (password !== undefined) { staff.passwordHash = await auth.hashPassword(password); changes.push("new password"); }
        await staff.save();
        if (password !== undefined || active === false || (role !== undefined && changes.some((c) => c.startsWith("role")))) {
            await auth.endAllSessions(staff._id);
        }
        await audit(req, "staff.update", staff._id, `${staff.username}: ${changes.join(", ") || "no change"}`);
        res.json(auth.publicStaff(staff));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not update the account" });
    }
});

// ---- Owner's phone app (Plan 19). For the owner who is logged in. ----
const ownerAppUrl = () => {
    const base = (process.env.REPORT_BASE_URL || "").trim().replace(/\/+$/, "");
    return base ? `${base}/owner` : "";
};

router.get("/owner-app", async (req, res) => {
    const me = await Staff.findById(req.staff._id).lean();
    res.json({ on: Boolean(me && me.ownerAppCodeSetAt && !me.ownerAppOffAt), setAt: me?.ownerAppCodeSetAt || null, url: ownerAppUrl() });
});

// A new code, shown once. The old code (if any) stops and its phones are logged out.
router.post("/owner-app/code", async (req, res) => {
    try {
        const me = await Staff.findById(req.staff._id).lean();
        if (!me) return res.status(404).json({ error: "Account not found" });
        const code = makeCode();
        await Staff.updateOne({ _id: me._id }, { $set: { ownerAppCodeHash: hashCode(code), ownerAppCodeSetAt: new Date() }, $unset: { ownerAppOffAt: 1 } });
        const had = Boolean(me.ownerAppCodeSetAt && !me.ownerAppOffAt);
        await audit(req, "owner.app", me._id, `${me.username}: ${had ? "new phone app code (old one stopped)" : "phone app turned on"}`);
        res.set("Cache-Control", "no-store").json({ code, url: ownerAppUrl() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not make the code" });
    }
});

router.post("/owner-app/off", async (req, res) => {
    try {
        const me = await Staff.findById(req.staff._id).lean();
        if (!me || !me.ownerAppCodeSetAt || me.ownerAppOffAt) return res.status(400).json({ error: "The phone app is not on." });
        await Staff.updateOne({ _id: me._id }, { $set: { ownerAppOffAt: new Date() }, $unset: { ownerAppCodeHash: 1 } });
        await audit(req, "owner.app", me._id, `${me.username}: phone app turned off`);
        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not turn it off" });
    }
});

router.get("/activity", async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = 50;
        const [rows, total] = await Promise.all([
            AuditLog.find({}).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            AuditLog.countDocuments({}),
        ]);
        res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not load activity" });
    }
});

module.exports = router;

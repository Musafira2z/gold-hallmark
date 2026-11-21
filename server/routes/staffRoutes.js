// Owner only: staff accounts and the activity log.
const express = require("express");
const mongoose = require("mongoose");
const Staff = require("../models/Staff");
const AuditLog = require("../models/AuditLog");
const auth = require("../services/authService");
const { audit } = require("../services/audit");

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

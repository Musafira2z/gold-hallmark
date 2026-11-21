const express = require("express");
const Staff = require("../models/Staff");
const Counter = require("../models/Counter");
const auth = require("../services/authService");
const { audit } = require("../services/audit");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Is this a brand-new install with no accounts yet?
router.get("/status", async (_req, res) => {
    try {
        res.json({ setupNeeded: await auth.setupNeeded() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Status check failed" });
    }
});

// First run only: create the owner account. Works once, ever.
router.post("/setup", async (req, res) => {
    try {
        if (!(await auth.setupNeeded())) return res.status(409).json({ error: "The owner account already exists. Please log in." });
        const { name, username, password } = req.body || {};
        const problem = auth.checkAccountInput({ name, username, password }, { passwordRequired: true });
        if (problem) return res.status(400).json({ error: problem });
        // A one-time lock, so two people pressing "Create" at the same moment can't both become owner.
        try {
            await Counter.create({ _id: "owner-setup", seq: 1 });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ error: "The owner account already exists. Please log in." });
            throw e;
        }
        const owner = await Staff.create({
            name: name.trim(),
            username: username.trim().toLowerCase(),
            passwordHash: await auth.hashPassword(password),
            role: "owner",
            lastLoginAt: new Date(),
        });
        const token = await auth.createSession(owner);
        await audit({ staff: owner }, "staff.setup", owner._id, `Owner account created: ${owner.username}`);
        res.status(201).json({ token, staff: auth.publicStaff(owner) });
    } catch (error) {
        console.error("Setup failed:", error);
        res.status(500).json({ error: "Setup failed" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const result = await auth.login(username, password);
        if (result.error) {
            if (result.status === 401) {
                await audit(result.staff ? { staff: result.staff } : null, "login.failed", undefined,
                    `Wrong password for "${String(username || "").slice(0, 30)}"`);
            }
            return res.status(result.status).json({ error: result.error });
        }
        await audit({ staff: result.staff }, "login", result.staff._id, `${result.staff.username} logged in`);
        res.json({ token: result.token, staff: auth.publicStaff(result.staff) });
    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

router.get("/me", requireAuth, (req, res) => res.json({ staff: auth.publicStaff(req.staff) }));

router.post("/logout", requireAuth, async (req, res) => {
    try {
        await auth.logout(req.token);
        await audit(req, "logout", req.staff._id, `${req.staff.username} logged out`);
        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Logout failed" });
    }
});

// Anyone logged in can change their own password (needs the current one).
router.post("/password", requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!(await auth.verifyPassword(currentPassword || "", req.staff.passwordHash))) {
            return res.status(400).json({ error: "Current password is wrong." });
        }
        const problem = auth.checkAccountInput({ password: newPassword }, { passwordRequired: true });
        if (problem) return res.status(400).json({ error: problem });
        req.staff.passwordHash = await auth.hashPassword(newPassword);
        await req.staff.save();
        await auth.endAllSessions(req.staff._id);
        const token = await auth.createSession(req.staff);
        await audit(req, "staff.password", req.staff._id, `${req.staff.username} changed own password`);
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not change password" });
    }
});

module.exports = router;

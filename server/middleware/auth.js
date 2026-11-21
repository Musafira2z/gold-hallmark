const { staffForToken } = require("../services/authService");

const tokenFrom = (req) => {
    const header = req.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1].trim() : "";
};

// Every API call needs a login (BUGS S1/S2).
const requireAuth = async (req, res, next) => {
    try {
        const staff = await staffForToken(tokenFrom(req));
        if (!staff) return res.status(401).json({ error: "Please log in." });
        req.staff = staff;
        req.token = tokenFrom(req);
        return next();
    } catch (error) {
        console.error("Login check failed:", error);
        return res.status(500).json({ error: "Login check failed" });
    }
};

// Only the owner (delete, restore, staff accounts, activity log).
const requireOwner = (req, res, next) => {
    if (!req.staff || req.staff.role !== "owner") {
        return res.status(403).json({ error: "Only the owner can do this." });
    }
    return next();
};

module.exports = { requireAuth, requireOwner, tokenFrom };

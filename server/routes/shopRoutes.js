const express = require("express");
const router = express.Router();
const { requireOwner } = require("../middleware/auth");
const { audit } = require("../services/audit");
const { listShops, renameShop, mergeShops } = require("../services/shopService");

// Shops (Plan 16). Everyone logged in can see the list; only the owner renames or merges.
router.get("/", async (req, res) => {
    try {
        const q = typeof req.query.q === "string" ? req.query.q.slice(0, 80) : "";
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 50);
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
            return res.status(400).json({ error: "page must be 1 or more, limit 1 to 200" });
        }
        res.json(await listShops({ q, page, limit }));
    } catch (error) {
        console.error("Error listing shops:", error);
        res.status(500).json({ error: "Could not load shops" });
    }
});

router.put("/:id", requireOwner, async (req, res) => {
    try {
        const name = req.body && typeof req.body.name === "string" ? req.body.name : "";
        const result = await renameShop(req.params.id, name);
        if (!result) return res.status(404).json({ error: "Shop not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        await audit(req, "shop.rename", result.shop._id, `${result.before} → ${result.shop.name}`);
        res.json(result.shop);
    } catch (error) {
        console.error("Error renaming shop:", error);
        res.status(500).json({ error: "Could not rename the shop" });
    }
});

// Body: { keep, drop } — the orders of `drop` move to `keep`.
router.post("/merge", requireOwner, async (req, res) => {
    try {
        const { keep, drop } = req.body || {};
        const result = await mergeShops(keep, drop);
        if (!result) return res.status(404).json({ error: "Shop not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        await audit(req, "shop.merge", result.keep._id, `${result.dropName} → ${result.keep.name} (${result.moved} orders)`);
        res.json(result);
    } catch (error) {
        console.error("Error merging shops:", error);
        res.status(500).json({ error: "Could not merge the shops" });
    }
});

module.exports = router;

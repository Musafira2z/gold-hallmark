const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { requireOwner } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload");

router.get("/", userController.getUsers);
router.post("/create", uploadImage, userController.createUser);
router.put("/update/:id", uploadImage, userController.updateUser);
router.delete("/delete/:id", requireOwner, userController.deleteUser); // owner only; keeps the customer
router.post("/:id/restore", requireOwner, userController.restoreUser);
router.get("/lastCustomerID", userController.getLastCustomerID);
router.get("/:customerID/profile", userController.getCustomerProfile);
router.put("/:customerID/kind", userController.setCustomerKind); // customer type (staff + owner)
// Online login for the portal (Plan 18), staff + owner
router.post("/:customerID/portal/pin", userController.makePortalPin);
router.post("/:customerID/portal/off", userController.portalOff);
router.put("/:customerID/portal/shops", userController.setPortalShops);

router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }

    if (err && err.message === "Only image files are allowed") {
        return res.status(400).json({ error: err.message });
    }

    return next(err);
});

module.exports = router;

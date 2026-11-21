const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { requireOwner } = require("../middleware/auth");
const multer = require("multer");
const upload = multer({dest: "uploads/"});

router.get("/", orderController.getOrders);
router.get("/summary", orderController.getOrderSummary); // before "/:id"
router.post("/", upload.single("image"), orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", requireOwner, orderController.deleteOrder); // owner only; keeps the order
router.post("/:id/restore", requireOwner, orderController.restoreOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;

const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { requireOwner } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload"); // photos only, 5 MB (BUGS D9)

router.get("/", orderController.getOrders);
router.get("/summary", orderController.getOrderSummary); // before "/:id"
router.post("/", uploadImage, orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.patch("/:id/status", orderController.setOrderStatus); // staff and owner
router.delete("/:id", requireOwner, orderController.deleteOrder); // owner only; keeps the order
router.post("/:id/restore", requireOwner, orderController.restoreOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;

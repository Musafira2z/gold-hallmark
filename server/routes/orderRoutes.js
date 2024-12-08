const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const multer = require("multer");
const upload = multer({dest: "uploads/"});

router.get("/", orderController.getOrders);
router.post("/", upload.single("image"), orderController.createOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;

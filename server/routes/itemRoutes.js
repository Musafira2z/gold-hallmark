const express = require("express");
const router = express.Router();
const itemController = require("../controllers/itemController");

router.get("/:type", itemController.getItemNames);
router.post("/", itemController.createItemName);

module.exports = router;


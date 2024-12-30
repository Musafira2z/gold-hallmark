const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.get("/", userController.getUsers);
router.post("/create", upload.single("image"), userController.createUser);
router.put("/update/:id",upload.single("image"), userController.updateUser);
router.delete("/delete/:id", userController.deleteUser);
router.get("/lastCustomerID", userController.getLastCustomerID);

module.exports = router;

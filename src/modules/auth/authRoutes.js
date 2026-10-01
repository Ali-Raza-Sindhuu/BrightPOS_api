const express = require("express");
const authenticate = require("../../middleware/authentication");
const authController = require("./authController");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
router.put("/me", authenticate, authController.updateMe);
router.post("/change-password", authenticate, authController.changePassword);

module.exports = router;

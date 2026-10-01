const express = require("express");
const authenticate = require("../../middleware/authentication");
const authController = require("./auth.controller");

const router = express.Router();


router.post("/login", require('../../middleware/login-limit'), authController.login);
router.get("/me", authenticate, authController.me);
router.put("/me", authenticate, authController.updateMe);
router.post("/change-password", authenticate, authController.changePassword);

module.exports = router;

const express = require("express");
const userController = require("./userController");
const authenticate = require("../../middleware/authentication");
const requireAdmin = require("../../middleware/requireAdmin");

const router = express.Router();

router.use(authenticate);

router.get("/", userController.list);
router.get("/:id", userController.getOne);

router.post("/", requireAdmin, userController.create);
router.put("/:id", requireAdmin, userController.update);
router.delete("/:id", requireAdmin, userController.remove);

module.exports = router;

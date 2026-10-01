const express = require("express");
const authenticate = require("../../middleware/authentication");
const requireAdmin = require("../../middleware/requireAdmin");
const groupController = require("./groupController"); // whatever your actual path is
// console.log(groupController);

const router = express.Router();

router.use(authenticate);

router.get("/", groupController.list);
router.get("/:id", groupController.getOne);

// Writes are admin-only until the Day 2 rights engine (group_rights) takes over.
router.post("/", requireAdmin, groupController.create);
router.put("/:id", requireAdmin, groupController.update);
router.delete("/:id", requireAdmin, groupController.remove);

router.get("/:id/users", requireAdmin, groupController.getMembers);
router.put("/:id/users", requireAdmin, groupController.setMembers);

module.exports = router;

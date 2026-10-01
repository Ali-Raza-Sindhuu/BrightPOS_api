const express = require("express");
const requireAdmin = require("../../middleware/require-admin");
const groupController = require("./group.controller"); // whatever your actual path is
// console.log(groupController);

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

router.use(...require('../../middleware/protect-resource')('GROUPS'));

router.get("/", groupController.list);
router.get("/:id", groupController.getOne);

// Writes are admin-only until the Day 2 rights engine (group_rights) takes over.
router.post("/", requireAdmin, groupController.create);
router.put("/:id", requireAdmin, groupController.update);
router.delete("/:id", requireAdmin, groupController.remove);

router.get("/:id/users", requireAdmin, groupController.getMembers);
router.put("/:id/users", requireAdmin, groupController.setMembers);

module.exports = router;

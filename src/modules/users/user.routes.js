const express = require("express");
const userController = require("./user.controller");
const requireAdmin = require("../../middleware/require-admin");

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

router.use(...require('../../middleware/protect-resource')('USER_GROUPS'));

router.get("/", userController.list);
router.get("/:id", userController.getOne);

router.post("/", requireAdmin, userController.create);
router.put("/:id", requireAdmin, userController.update);
router.delete("/:id", requireAdmin, userController.remove);

module.exports = router;

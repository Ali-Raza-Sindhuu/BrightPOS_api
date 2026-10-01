const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('ITEM_TYPE'));
const controller = require("./item-type.controller");

router.route("/").get(controller.getAll).post(controller.create);
router.route("/:id").get(controller.getOne).put(controller.update).delete(controller.remove);

module.exports = router;

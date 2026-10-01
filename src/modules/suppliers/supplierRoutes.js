const express = require("express");
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('SUPPLIERS'));
const controller = require("./supplierController");

router.route("/").get(controller.getAll).post(controller.create);
router.route("/:id").get(controller.getOne).put(controller.update).delete(controller.remove);

module.exports = router;

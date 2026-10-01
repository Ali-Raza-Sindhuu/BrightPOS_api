const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('ITEMS'));
const controller = require("./items.controller");
const upload = require("../../middleware/upload");

router.get("/low-stock", controller.getLowStock);

router.route("/")
    .get(controller.getAll)
    .post(upload.single("image"), controller.create);

router.route("/:id")
    .get(controller.getOne)
    .put(upload.single("image"), controller.update)
    .delete(controller.remove);

module.exports = router;

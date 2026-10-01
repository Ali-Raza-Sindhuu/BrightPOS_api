const express = require("express");
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('ITEMS'));
const controller = require("./itemsController");
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

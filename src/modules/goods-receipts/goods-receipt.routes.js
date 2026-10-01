const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('GOODS_RECEIPT'));
const controller = require("./goods-receipt.controller");

// GET /api/goods-receipts?page=&limit=&status=&purchase_id=
router.get("/", controller.getAll);

// GET  /api/goods-receipts/:id
// POST /api/goods-receipts/:id/receive   { items?: [{item_id, received_qty}], remarks? }
router.get("/:id", controller.getOne);
router.post("/:id/receive", controller.receive);

module.exports = router;

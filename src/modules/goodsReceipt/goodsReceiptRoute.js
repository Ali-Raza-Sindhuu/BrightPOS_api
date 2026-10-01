const express = require("express");
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('GOODS_RECEIPT'));
const controller = require("./goodsReceiptController");

// GET /api/goods-receipts?page=&limit=&status=&purchase_id=
router.get("/", controller.getAll);

// GET  /api/goods-receipts/:id
// POST /api/goods-receipts/:id/receive   { items?: [{item_id, received_qty}], remarks? }
router.get("/:id", controller.getOne);
router.post("/:id/receive", controller.receive);

module.exports = router;

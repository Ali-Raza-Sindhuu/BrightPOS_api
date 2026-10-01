const express = require("express");
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('PURCHASES'));
const controller = require("./purchase.controller");

// GET  /api/purchases?page=&limit=&search=&supplier_id=&payment_status=&order_status=
// POST /api/purchases   { supplier_id, invoice_no, notes, discount_percent, items: [{item_id, qty, purchase_price, sale_price}] }
router.route("/").get(controller.getAll).post(controller.create);

router.route("/:id").get(controller.getOne).put(controller.update).delete(controller.remove);

module.exports = router;
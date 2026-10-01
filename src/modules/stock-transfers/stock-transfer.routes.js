const express = require('express');
const controller = require('./stock-transfer.controller');
const pool = require('../../config/db');

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });
router.param('business_unit_id', (req, res, next, value) => { try { req.params.business_unit_id = require('../../utils/validation').id(value, 'business_unit_id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('STOCK_TRANSFER'));

router.get('/', controller.list);

router.get('/:id', controller.getOne);

router.post('/', controller.create);

router.delete('/:id', controller.remove);
// e.g. GET /inventory/by-unit/:business_unit_id
router.get('/by-unit/:business_unit_id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT i.id, i.item_name, COALESCE(inv.quantity, 0) AS current_stock
     FROM item_details i
     LEFT JOIN inventory inv ON inv.item_id = i.id AND inv.business_unit_id = ?
     WHERE i.is_enable = 1`,
    [req.params.business_unit_id]
  );
  res.json({ success: true, data: rows });
});
// No PUT.
// A stock transfer should not be edited after posting.
// Reverse the transfer and create a new one instead.

module.exports = router;
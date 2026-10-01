const express = require('express');
const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const buildCrudModule = require('../../utils/buildCrudModule');

const { model, controller } = buildCrudModule({
  table: 'expiry_tags',
  columns: [
    'expiry_date',
    'manufacturer_date',
    'item_id',
    'description',
    'receipt_no',
    'item_code',
    'purchase_price',
    'sale_price',
  ],
  requiredOnCreate: ['item_id', 'expiry_date'],
  searchColumns: ['item_code', 'receipt_no'],
  entityName: 'Expiry tag',
});

async function validateItem(itemId) {
  const [rows] = await pool.query('SELECT id FROM item_details WHERE id = ?', [itemId]);
  if (!rows.length) throw new ApiError(422, `item_id ${itemId} does not exist`);
}

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('EXPIRY_TAGS'));

router.get('/', controller.list);

// Convenience: items whose expiry falls within the next N days (default 30)
router.get(
  '/expiring-soon',
  catchAsync(async (req, res) => {
    const days = Number.isFinite(Number(req.query.days)) ? Number(req.query.days) : 30;
    const [rows] = await pool.query(
      `SELECT et.*, id_.item_name
       FROM expiry_tags et
       LEFT JOIN item_details id_ ON id_.id = et.item_id
       WHERE et.expiry_date IS NOT NULL
         AND et.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY et.expiry_date ASC`,
      [days]
    );
    sendResponse(res, 200, 'Expiring items fetched successfully', rows);
  })
);

router.get('/:id', controller.getOne);

router.post(
  '/',
  catchAsync(async (req, res) => {
    if (!req.body.item_id || !req.body.expiry_date) {
      throw new ApiError(422, 'item_id and expiry_date are required');
    }
    await validateItem(req.body.item_id);
    const id = await model.create(req.body);
    sendResponse(res, 201, 'Expiry tag created successfully', await model.findById(id));
  })
);

router.put(
  '/:id',
  catchAsync(async (req, res) => {
    const existing = await model.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'Expiry tag not found');
    if (req.body.item_id) await validateItem(req.body.item_id);

    await model.update(req.params.id, req.body);
    sendResponse(res, 200, 'Expiry tag updated successfully', await model.findById(req.params.id));
  })
);

router.delete('/:id', controller.remove);

module.exports = router;

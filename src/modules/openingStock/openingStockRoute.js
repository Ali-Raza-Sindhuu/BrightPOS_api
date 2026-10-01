// openingStockRoutes.js
const express = require('express');
const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('OPENING_STOCK'));
const openingStockController = require('./openingStockController');



router.post(
  '/',
  openingStockController.createOpeningStock
);

router.get(
  '/',
  openingStockController.getOpeningStockList
);

router.get(
  '/:id',
  openingStockController.getOpeningStockById
);

router.get(
  '/item-stock/:business_unit_id',
  openingStockController.getItemStockByBranch
);

module.exports = router;
// openingStockRoutes.js
const express = require('express');
const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });
router.param('business_unit_id', (req, res, next, value) => { try { req.params.business_unit_id = require('../../utils/validation').id(value, 'business_unit_id'); next(); } catch (error) { next(error); } });

const protectResource = require('../../middleware/protect-resource');
router.use(...protectResource('OPENING_STOCK'));
const openingStockController = require('./opening-stock.controller');
router.delete('/:id', openingStockController.deleteOpeningStock);



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

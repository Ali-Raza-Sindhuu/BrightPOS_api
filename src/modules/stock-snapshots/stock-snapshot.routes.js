const express = require("express");

const controller = require("./stock-snapshot.controller");

const router = express.Router();
router.param('id', (req, res, next, value) => { try { req.params.id = require('../../utils/validation').id(value, 'id'); next(); } catch (error) { next(error); } });
router.param('itemId', (req, res, next, value) => { try { req.params.itemId = require('../../utils/validation').id(value, 'itemId'); next(); } catch (error) { next(error); } });

const authenticate = require('../../middleware/authentication');
const requireAdmin = require('../../middleware/require-admin');
router.use(authenticate, requireAdmin);

/**
 * Stock Snapshot Routes
 */

// Get All Snapshots
router.get("/", controller.list);

// Get Single Snapshot
router.get("/:id", controller.getOne);

// Generate New Snapshot
router.post("/", controller.create);

// Manual Adjustment
router.patch(
  "/:id/items/:itemId/adjustment",
  controller.updateItemAdjustment
);

module.exports = router;
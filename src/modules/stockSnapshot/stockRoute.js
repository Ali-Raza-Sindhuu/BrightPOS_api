const express = require("express");

const controller = require("./stockController");

const router = express.Router();

const authenticate = require('../../middleware/authentication');
const requireAdmin = require('../../middleware/requireAdmin');
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
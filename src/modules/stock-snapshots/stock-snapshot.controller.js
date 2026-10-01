const catchAsync = require("../../utils/catch-async");
const sendResponse = require("../../utils/send-response");

const StockSnapshotService = require("./stock-snapshot.service");

/**
 * Get All Snapshots
 */
exports.list = catchAsync(async (req, res) => {
  const result = await StockSnapshotService.list(req.query);

  sendResponse(
    res,
    200,
    "Stock snapshots fetched successfully",
    result.rows,
    result.meta
  );
});

/**
 * Get Single Snapshot
 */
exports.getOne = catchAsync(async (req, res) => {
  const result = await StockSnapshotService.get(req.params.id);

  sendResponse(
    res,
    200,
    "Stock snapshot fetched successfully",
    result
  );
});

/**
 * Create Snapshot
 */
exports.create = catchAsync(async (req, res) => {
  const result = await StockSnapshotService.create(req.body);

  sendResponse(
    res,
    201,
    "Stock snapshot generated successfully",
    result
  );
});

/**
 * Update Manual Adjustment
 */
exports.updateItemAdjustment = catchAsync(async (req, res) => {

  const result =
    await StockSnapshotService.updateItemAdjustment(
      req.params.id,
      req.params.itemId,
      Number(req.body.adjustment)
    );

  sendResponse(
    res,
    200,
    "Snapshot line item adjusted successfully",
    result
  );

});
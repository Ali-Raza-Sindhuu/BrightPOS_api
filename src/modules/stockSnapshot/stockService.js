const pool = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const StockSnapshotModel = require("./stockModel");

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Get all snapshots
 */
async function list(query) {
  const { page, limit, offset } = getPagination(query);

  const [rows, total] = await Promise.all([
    StockSnapshotModel.findAll(limit, offset),
    StockSnapshotModel.count(),
  ]);

  return {
    rows,
    meta: buildMeta({
      page,
      limit,
      total,
    }),
  };
}

/**
 * Get snapshot by id
 */
async function get(id) {
  const snapshot = await StockSnapshotModel.findById(id);

  if (!snapshot) {
    throw new ApiError(404, "Stock snapshot not found");
  }

  const items =
    await StockSnapshotModel.findItemsBySnapshotId(id);

  return {
    ...snapshot,
    items,
  };
}

/**
 * Create Snapshot
 */
async function create(body) {
  if (!body.closing_date) {
    throw new ApiError(
      422,
      "closing_date is required"
    );
  }

  const conn = await pool.getConnection();

  try {

    await conn.beginTransaction();

    // Check duplicate snapshot

    const existing =
      await StockSnapshotModel.findPreviousSnapshot(
        conn,
        "9999-12-31"
      );

    const [[already]] = await conn.query(
      `
      SELECT id
      FROM stock_snapshots
      WHERE closing_date = ?
      `,
      [body.closing_date]
    );

    if (already) {
      throw new ApiError(
        409,
        `Snapshot already exists for ${body.closing_date}`
      );
    }

    // Previous Snapshot

    const previousSnapshot =
      await StockSnapshotModel.findPreviousSnapshot(
        conn,
        body.closing_date
      );

    // Opening Stock

    const openingStockMap =
      await StockSnapshotModel.getOpeningStockMap(
        conn,
        previousSnapshot
          ? previousSnapshot.id
          : null
      );

    // Date Range

    const fromDate = previousSnapshot
      ? previousSnapshot.closing_date
      : "1970-01-01";

    const toDate = body.closing_date;

    // Purchases

    const purchasedMap =
      await StockSnapshotModel.getPurchasedQtyMap(
        conn,
        fromDate,
        toDate
      );

    // Sales

    const soldMap =
      await StockSnapshotModel.getSoldQtyMap(
        conn,
        fromDate,
        toDate
      );

    // Enabled Items

    const items =
      await StockSnapshotModel.getAllEnabledItems(
        conn
      );

    // Create Snapshot

    const snapshotId =
      await StockSnapshotModel.createSnapshot(
        conn,
        body.closing_date
      );
          // Prepare snapshot item rows

    const rows = items.map((item) => {

      // Opening Stock

      const openingStock =
        openingStockMap.has(item.id)
          ? Number(openingStockMap.get(item.id))
          : Number(item.stock);

      // Purchased Quantity

      const purchasedQty = Number(
        purchasedMap.get(item.id) || 0
      );

      // Sold Quantity

      const soldQty = Number(
        soldMap.get(item.id) || 0
      );

      // Manual Adjustment

      const adjustment = 0;

      // Closing Stock

      const closingStock = round2(
        openingStock +
          purchasedQty -
          soldQty +
          adjustment
      );

      return [
        snapshotId,
        item.id,
        openingStock,
        purchasedQty,
        soldQty,
        adjustment,
        closingStock,
        item.purchase_price,
        item.sale_price,
      ];
    });

    // Insert all snapshot items

    if (rows.length > 0) {
      await StockSnapshotModel.insertSnapshotItems(
        conn,
        rows
      );
    }

    // Commit Transaction

    await conn.commit();

    return await get(snapshotId);

  } catch (error) {

    await conn.rollback();

    throw error;

  } finally {

    conn.release();

  }
}

/**
 * Manual Adjustment
 */

async function updateItemAdjustment(
  snapshotId,
  itemId,
  adjustment
) {

  if (!Number.isFinite(adjustment)) {

    throw new ApiError(
      422,
      "adjustment must be a number"
    );

  }

  const row =
    await StockSnapshotModel.findSnapshotItem(
      snapshotId,
      itemId
    );

  if (!row) {

    throw new ApiError(
      404,
      "Snapshot line item not found"
    );

  }

  const closingStock = round2(
    Number(row.opening_stock) +
      Number(row.total_purchases) -
      Number(row.total_sales) +
      Number(adjustment)
  );

  await StockSnapshotModel.updateAdjustment(
    row.id,
    adjustment,
    closingStock
  );

  return await get(snapshotId);
}

module.exports = {
    list,
    get,
    create,
    updateItemAdjustment,
};
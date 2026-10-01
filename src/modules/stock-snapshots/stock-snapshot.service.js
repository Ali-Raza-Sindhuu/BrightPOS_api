const pool = require("../../config/db");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const StockSnapshotModel = require("./stock-snapshot.model");

const round2 = require('../../utils/money').round2;

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
  require('../../utils/validation').date(body.closing_date, 'closing_date');
  const conn = await pool.getConnection();
  let snapshotId;
  try {
    await conn.beginTransaction();
    const [[duplicate]] = await conn.query('SELECT id FROM stock_snapshots WHERE closing_date = ?', [body.closing_date]);
    if (duplicate) throw new ApiError(409, 'Snapshot already exists for this date');
    const [items] = await conn.query(
      'SELECT i.id, i.purchase_price, i.sale_price, COALESCE(SUM(CASE WHEN s.created_at < DATE_ADD(?, INTERVAL 1 DAY) THEN s.qty ELSE 0 END),0) AS closing_qty, COALESCE(SUM(CASE WHEN s.created_at < ? THEN s.qty ELSE 0 END),0) AS opening_qty, COALESCE(SUM(CASE WHEN s.created_at >= ? AND s.created_at < DATE_ADD(?, INTERVAL 1 DAY) AND s.qty > 0 THEN s.qty ELSE 0 END),0) AS received_qty, COALESCE(SUM(CASE WHEN s.created_at >= ? AND s.created_at < DATE_ADD(?, INTERVAL 1 DAY) AND s.qty < 0 THEN -s.qty ELSE 0 END),0) AS issued_qty FROM item_details i LEFT JOIN item_stock s ON s.item_id = i.id GROUP BY i.id ORDER BY i.id',
      [body.closing_date, body.closing_date, body.closing_date, body.closing_date, body.closing_date, body.closing_date]);
    snapshotId = await StockSnapshotModel.createSnapshot(conn, body.closing_date);
    if (items.length) await StockSnapshotModel.insertSnapshotItems(conn, items.map(item => [snapshotId, item.id, item.opening_qty, item.received_qty, item.issued_qty, 0, item.closing_qty, item.purchase_price, item.sale_price]));
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  return get(snapshotId);
}

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
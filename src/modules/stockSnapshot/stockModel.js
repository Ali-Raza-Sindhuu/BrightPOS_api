const pool = require("../../config/db");

// ============================
// Snapshot Queries
// ============================

async function findAll(limit, offset) {
  const [rows] = await pool.query(
    `SELECT *
     FROM stock_snapshots
     ORDER BY closing_date DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return rows;
}

async function count() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM stock_snapshots`
  );

  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT *
     FROM stock_snapshots
     WHERE id = ?`,
    [id]
  );

  return rows[0];
}

async function findItemsBySnapshotId(snapshotId) {
  const [rows] = await pool.query(
    `
      SELECT
          ssi.*,
          id_.item_name
      FROM stock_snapshot_items ssi
      LEFT JOIN item_details id_
          ON id_.id = ssi.item_id
      WHERE ssi.snapshot_id = ?
      ORDER BY id_.item_name
    `,
    [snapshotId]
  );

  return rows;
}

// ============================
// Previous Snapshot
// ============================

async function findPreviousSnapshot(conn, closingDate) {
  const [rows] = await conn.query(
    `
      SELECT id, closing_date
      FROM stock_snapshots
      WHERE closing_date < ?
      ORDER BY closing_date DESC
      LIMIT 1
    `,
    [closingDate]
  );

  return rows[0];
}

async function getOpeningStockMap(conn, snapshotId) {
  if (!snapshotId) return new Map();

  const [rows] = await conn.query(
    `
      SELECT
          item_id,
          calc_closing
      FROM stock_snapshot_items
      WHERE snapshot_id = ?
    `,
    [snapshotId]
  );

  return new Map(rows.map((r) => [r.item_id, r.calc_closing]));
}

// ============================
// Purchases
// ============================

async function getPurchasedQtyMap(conn, fromDate, toDate) {
  const [rows] = await conn.query(
    `
      SELECT
          pi.item_id,
          SUM(pi.qty) AS qty
      FROM purchase_items pi
      JOIN purchases p
          ON p.id = pi.purchase_id
      WHERE
          p.order_status = 'received'
          AND DATE(p.created_at) > ?
          AND DATE(p.created_at) <= ?
      GROUP BY pi.item_id
    `,
    [fromDate, toDate]
  );

  return new Map(rows.map((r) => [r.item_id, r.qty]));
}

// ============================
// Sales
// ============================

async function getSoldQtyMap(conn, fromDate, toDate) {
  const [rows] = await conn.query(
    `
      SELECT
          sii.item_id,
          SUM(sii.qty) AS qty
      FROM sale_invoice_items sii
      JOIN sale_invoices si
          ON si.id = sii.invoice_id
      WHERE
          DATE(si.created_at) > ?
          AND DATE(si.created_at) <= ?
      GROUP BY sii.item_id
    `,
    [fromDate, toDate]
  );

  return new Map(rows.map((r) => [r.item_id, r.qty]));
}

// ============================
// Items
// ============================

async function getAllEnabledItems(conn) {
  const [rows] = await conn.query(
    `
      SELECT
          id,
          stock,
          purchase_price,
          sale_price
      FROM item_details
      WHERE is_enable = 1
    `
  );

  return rows;
}

// ============================
// Create Snapshot
// ============================

async function createSnapshot(conn, closingDate) {
  const [result] = await conn.query(
    `
      INSERT INTO stock_snapshots (closing_date)
      VALUES (?)
    `,
    [closingDate]
  );

  return result.insertId;
}

async function insertSnapshotItems(conn, rows) {
  return conn.query(
    `
      INSERT INTO stock_snapshot_items
      (
          snapshot_id,
          item_id,
          opening_stock,
          total_purchases,
          total_sales,
          adjustment,
          calc_closing,
          purchase_price,
          sale_price
      )
      VALUES ?
    `,
    [rows]
  );
}

// ============================
// Adjustment
// ============================

async function findSnapshotItem(snapshotId, itemId) {
  const [rows] = await pool.query(
    `
      SELECT *
      FROM stock_snapshot_items
      WHERE snapshot_id = ?
      AND item_id = ?
    `,
    [snapshotId, itemId]
  );

  return rows[0];
}

async function updateAdjustment(id, adjustment, closing) {
  return pool.query(
    `
      UPDATE stock_snapshot_items
      SET
          adjustment = ?,
          calc_closing = ?
      WHERE id = ?
    `,
    [adjustment, closing, id]
  );
}

module.exports = {
  findAll,
  count,
  findById,
  findItemsBySnapshotId,

  findPreviousSnapshot,
  getOpeningStockMap,

  getPurchasedQtyMap,
  getSoldQtyMap,

  getAllEnabledItems,

  createSnapshot,
  insertSnapshotItems,

  findSnapshotItem,
  updateAdjustment,
};
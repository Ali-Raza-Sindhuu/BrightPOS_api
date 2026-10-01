const pool = require('../../config/db');

async function getPurchaseForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, supplier_id, business_unit_id, order_status FROM purchases WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

// Original line items for the purchase, grouped by item_id — caps how much
// of each item can be returned and defaults the return price.
async function getOriginalLinesByPurchase(conn, purchaseId) {
  const [rows] = await conn.query(
    `SELECT item_id, SUM(qty) AS ordered_qty, MIN(purchase_price) AS purchase_price
     FROM purchase_items WHERE purchase_id = ? GROUP BY item_id`,
    [purchaseId]
  );
  return rows;
}

// How much of each item has already been returned against this purchase
// across all prior purchase_returns.
async function getReturnedQtyByPurchase(conn, purchaseId) {
  const [rows] = await conn.query(
    `SELECT pri.item_id, SUM(pri.qty) AS returned_qty
     FROM purchase_return_items pri
     JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
     WHERE pr.purchase_id = ?
     GROUP BY pri.item_id`,
    [purchaseId]
  );
  return rows;
}

async function getItemsForUpdate(conn, itemIds) {
  if (!itemIds.length) return [];
  const [rows] = await conn.query(
    'SELECT id, item_name, item_unit_id, stock FROM item_details WHERE id IN (?) FOR UPDATE',
    [itemIds]
  );
  return rows;
}

// Per-location on-hand quantity — goods can only be sent back to the
// supplier from the location that actually has them.
async function getInventoryQuantities(conn, itemIds, businessUnitId) {
  if (!itemIds.length) return new Map();
  const [rows] = await conn.query(
    'SELECT item_id, quantity FROM inventory WHERE item_id IN (?) AND business_unit_id = ? FOR UPDATE',
    [itemIds, businessUnitId]
  );
  return new Map(rows.map((r) => [r.item_id, r.quantity]));
}

// async function decrementStock(conn, itemId, qty) {
//   await conn.query('UPDATE item_details SET stock = stock - ? WHERE id = ?', [qty, itemId]);
// }

// async function incrementStock(conn, itemId, qty) {
//   await conn.query('UPDATE item_details SET stock = stock + ? WHERE id = ?', [qty, itemId]);
// }

async function insertLedgerEntry(conn, { businessUnitId, itemId, type, qty, refType, refId }) {
  await conn.query(
    `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessUnitId, itemId, type, qty, refType, refId]
  );
}
// Same upsert-by-(item_id, unit_id, business_unit_id) used elsewhere;
// negative delta removes stock being sent back to the supplier, positive
// delta (delete/undo) adds it back.
async function adjustInventory(conn, itemId, unitId, businessUnitId, deltaQty) {
  const [rows] = await conn.query(
    'SELECT id, quantity FROM inventory WHERE item_id = ? AND unit_id = ? AND business_unit_id = ? FOR UPDATE',
    [itemId, unitId, businessUnitId]
  );
  if (rows.length) {
    await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [deltaQty, rows[0].id]);
  } else {
    await conn.query(
      'INSERT INTO inventory (item_id, unit_id, business_unit_id, quantity) VALUES (?, ?, ?, ?)',
      [itemId, unitId, businessUnitId, Math.max(deltaQty, 0)]
    );
  }
}

async function insertReturnHeader(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO purchase_returns (purchase_id, supplier_id, return_date, total_amount, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [data.purchase_id, data.supplier_id, data.return_date, data.total_amount, data.reason ?? null]
  );
  return result.insertId;
}

async function insertReturnItems(conn, purchaseReturnId, items) {
  const values = items.map((it) => [purchaseReturnId, it.item_id, it.qty, it.purchase_price, it.total]);
  await conn.query(
    'INSERT INTO purchase_return_items (purchase_return_id, item_id, qty, purchase_price, total) VALUES ?',
    [values]
  );
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE p.invoice_no LIKE ? OR s.supplier_name LIKE ?',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT pr.*, p.invoice_no, s.supplier_name
     FROM purchase_returns pr
     JOIN purchases p ON p.id = pr.purchase_id
     LEFT JOIN suppliers s ON s.id = pr.supplier_id
     ${clause}
     ORDER BY pr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM purchase_returns pr
     JOIN purchases p ON p.id = pr.purchase_id
     LEFT JOIN suppliers s ON s.id = pr.supplier_id
     ${clause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT pr.*, p.invoice_no, s.supplier_name
     FROM purchase_returns pr
     JOIN purchases p ON p.id = pr.purchase_id
     LEFT JOIN suppliers s ON s.id = pr.supplier_id
     WHERE pr.id = ?`,
    [id]
  );
  return rows[0];
}

async function findItemsByReturnId(returnId) {
  const [rows] = await pool.query(
    `SELECT pri.*, id_.item_name
     FROM purchase_return_items pri
     LEFT JOIN item_details id_ ON id_.id = pri.item_id
     WHERE pri.purchase_return_id = ?`,
    [returnId]
  );
  return rows;
}

async function updateMeta(id, data) {
  await pool.query('UPDATE purchase_returns SET return_date = ?, reason = ? WHERE id = ?', [
    data.return_date,
    data.reason ?? null,
    id,
  ]);
}

async function getByIdForUpdate(conn, id) {
  const [rows] = await conn.query('SELECT * FROM purchase_returns WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function deleteReturnItems(conn, id) {
  await conn.query('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [id]);
}

async function deleteReturnHeader(conn, id) {
  await conn.query('DELETE FROM purchase_returns WHERE id = ?', [id]);
}

module.exports = {
  getPurchaseForUpdate,
  getOriginalLinesByPurchase,
  getReturnedQtyByPurchase,
  getItemsForUpdate,
  getInventoryQuantities,
  insertLedgerEntry,
  // decrementStock,
  // incrementStock,
  adjustInventory,
  insertReturnHeader,
  insertReturnItems,
  findAll,
  count,
  findById,
  findItemsByReturnId,
  updateMeta,
  getByIdForUpdate,
  deleteReturnItems,
  deleteReturnHeader,
};

const pool = require('../../config/db');

async function getInvoiceForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, customer_id, business_unit_id, status FROM sale_invoices WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

// Original line items for the invoice, grouped by item_id — used to cap how
// much of each item can be returned and to default the return price.
async function getOriginalLinesByInvoice(conn, invoiceId) {
  const [rows] = await conn.query(
    `SELECT item_id, SUM(qty) AS ordered_qty, MIN(unit_price) AS unit_price, MAX(unit_price) AS max_unit_price
     FROM sale_invoice_items WHERE invoice_id = ? GROUP BY item_id`,
    [invoiceId]
  );
  return rows;
}

// How much of each item has already been returned against this invoice
// across all prior sale_returns (so repeat partial returns can't exceed
// what was originally sold).
async function getReturnedQtyByInvoice(conn, invoiceId) {
  const [rows] = await conn.query(
    `SELECT sri.item_id, SUM(sri.qty) AS returned_qty
     FROM sale_return_items sri
     JOIN sale_returns sr ON sr.id = sri.sale_return_id
     WHERE sr.sale_invoice_id = ?
     GROUP BY sri.item_id`,
    [invoiceId]
  );
  return rows;
}

async function getItemsForUpdate(conn, itemIds) {
  if (!itemIds.length) return [];
  const [rows] = await conn.query(
    'SELECT id, item_name, item_unit_id FROM item_details WHERE id IN (?) FOR UPDATE',
    [itemIds]
  );
  return rows;
}

// Upsert-by-(item_id, business_unit_id) on item_stock; positive delta adds
// back on create, negative delta (used on delete/undo) removes what was added.
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
async function insertLedgerEntry(conn, { businessUnitId, itemId, type, qty, refType, refId }) {
  await conn.query(
    `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessUnitId, itemId, type, qty, refType, refId]
  );
}
async function adjustCustomerBalance(conn, customerId, delta) {
  await conn.query('UPDATE customers SET previous_balance = previous_balance + ? WHERE id = ?', [
    delta,
    customerId,
  ]);
}

async function insertReturnHeader(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO sale_returns (sale_invoice_id, customer_id, return_date, total_amount, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [data.sale_invoice_id, data.customer_id, data.return_date, data.total_amount, data.reason ?? null]
  );
  return result.insertId;
}

async function insertReturnItems(conn, saleReturnId, items) {
  const values = items.map((it) => [saleReturnId, it.item_id, it.qty, it.price, it.total]);
  await conn.query(
    'INSERT INTO sale_return_items (sale_return_id, item_id, qty, price, total) VALUES ?',
    [values]
  );
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE si.receipt_no LIKE ? OR c.customer_name LIKE ?',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT sr.*, si.receipt_no, c.customer_name
     FROM sale_returns sr
     JOIN sale_invoices si ON si.id = sr.sale_invoice_id
     LEFT JOIN customers c ON c.id = sr.customer_id
     ${clause}
     ORDER BY sr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM sale_returns sr
     JOIN sale_invoices si ON si.id = sr.sale_invoice_id
     LEFT JOIN customers c ON c.id = sr.customer_id
     ${clause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT sr.*, si.receipt_no, c.customer_name
     FROM sale_returns sr
     JOIN sale_invoices si ON si.id = sr.sale_invoice_id
     LEFT JOIN customers c ON c.id = sr.customer_id
     WHERE sr.id = ?`,
    [id]
  );
  return rows[0];
}

async function findItemsByReturnId(returnId) {
  const [rows] = await pool.query(
    `SELECT sri.*, id_.item_name
     FROM sale_return_items sri
     LEFT JOIN item_details id_ ON id_.id = sri.item_id
     WHERE sri.sale_return_id = ?`,
    [returnId]
  );
  return rows;
}

async function updateMeta(id, data) {
  await pool.query('UPDATE sale_returns SET return_date = ?, reason = ? WHERE id = ?', [
    data.return_date,
    data.reason ?? null,
    id,
  ]);
}

async function getByIdForUpdate(conn, id) {
  const [rows] = await conn.query('SELECT * FROM sale_returns WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function deleteReturnItems(conn, id) {
  await conn.query('DELETE FROM sale_return_items WHERE sale_return_id = ?', [id]);
}

async function deleteReturnHeader(conn, id) {
  await conn.query('DELETE FROM sale_returns WHERE id = ?', [id]);
}

module.exports = {
  getInvoiceForUpdate,
  getOriginalLinesByInvoice,
  getReturnedQtyByInvoice,
  getItemsForUpdate,
  adjustInventory,
  adjustCustomerBalance,
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
  insertLedgerEntry
};
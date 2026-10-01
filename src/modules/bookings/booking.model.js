const pool = require('../../config/db');

async function getCustomerById(conn, id) {
  const [rows] = await conn.query('SELECT id FROM customers WHERE id = ?', [id]);
  return rows[0];
}

async function getBusinessUnitById(conn, id) {
  const [rows] = await conn.query('SELECT id, is_active FROM business_units WHERE id = ?', [id]);
  return rows[0];
}

async function getItemsForUpdate(conn, itemIds) {
  if (!itemIds.length) return [];
  const [rows] = await conn.query(
    'SELECT id, item_name, sale_price, stock, item_unit_id, is_enable FROM item_details WHERE id IN (?) FOR UPDATE',
    [itemIds]
  );
  return rows;
}

async function getInventoryQuantities(conn, itemIds, businessUnitId) {
  if (!itemIds.length) return new Map();
  const [rows] = await conn.query(
    'SELECT item_id, quantity FROM inventory WHERE item_id IN (?) AND business_unit_id = ? FOR UPDATE',
    [itemIds, businessUnitId]
  );
  return new Map(rows.map((r) => [r.item_id, r.quantity]));
}

async function insertLedgerEntry(conn, { businessUnitId, itemId, type, qty, refType, refId }) {
  await conn.query(
    `INSERT INTO item_stock (business_unit_id, item_id, type, qty, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [businessUnitId, itemId, type, qty, refType, refId]
  );
}

async function adjustInventory(conn, itemId, unitId, businessUnitId, deltaQty) {
  return require('../../utils/inventory').adjustInventory(conn, itemId, unitId, businessUnitId, Number(deltaQty));
}

async function insertHeader(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO bookings
      (customer_id, business_unit_id, booking_date, booking_time, sub_total, discount, payable, paid, to_be_paid, payment_method, booking_status, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pending', 'Unpaid')`,
    [
      data.customer_id ?? null,
      data.business_unit_id,
      data.booking_date,
      data.booking_time ?? null,
      data.sub_total,
      data.discount,
      data.payable,
      data.payable,
      data.payment_method ?? null,
    ]
  );
  return result.insertId;
}

async function insertItems(conn, bookingId, items) {
  const values = items.map((it) => [bookingId, it.item_id, it.qty, it.unit_price, it.total_price]);
  await conn.query(
    'INSERT INTO booking_items (booking_id, item_id, qty, unit_price, total_price) VALUES ?',
    [values]
  );
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return { clause: 'WHERE c.customer_name LIKE ?', params: [`%${search}%`] };
}

// Shared subquery: one row per booking_id with its true payments total.
// Used everywhere a booking's paid/to_be_paid figure is read, so the
// displayed numbers always trace back to booking_payments rather than
// the (occasionally stale) bookings.paid / bookings.to_be_paid columns.
const PAYMENTS_SUM_JOIN = `
  LEFT JOIN (
    SELECT booking_id, SUM(amount) AS total_paid
    FROM booking_payments
    GROUP BY booking_id
  ) bp ON bp.booking_id = b.id
`;
const ACTUAL_PAID_SELECT = `
  COALESCE(bp.total_paid, 0) AS actual_paid,
  (b.payable - COALESCE(bp.total_paid, 0)) AS actual_to_be_paid
`;

async function findAll({ limit, offset, search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('b.booking_status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT b.*, c.customer_name, ${ACTUAL_PAID_SELECT}
     FROM bookings b
     LEFT JOIN customers c ON c.id = b.customer_id
     ${PAYMENTS_SUM_JOIN}
     ${whereClause}
     ORDER BY b.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('b.booking_status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id ${whereClause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT b.*, c.customer_name, ${ACTUAL_PAID_SELECT}
     FROM bookings b
     LEFT JOIN customers c ON c.id = b.customer_id
     ${PAYMENTS_SUM_JOIN}
     WHERE b.id = ?`,
    [id]
  );
  return rows[0];
}

async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function findItemsByBookingId(bookingId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT bi.*, id_.item_name
     FROM booking_items bi
     LEFT JOIN item_details id_ ON id_.id = bi.item_id
     WHERE bi.booking_id = ?`,
    [bookingId]
  );
  return rows;
}

async function updateHeader(id, data) {
  await pool.query(
    `UPDATE bookings SET customer_id = ?, booking_date = ?, booking_time = ?, discount = ?, payable = ?, to_be_paid = ?
     WHERE id = ?`,
    [data.customer_id ?? null, data.booking_date, data.booking_time ?? null, data.discount, data.payable, data.to_be_paid, id]
  );
}

async function updateStatus(conn, id, status) {
  await conn.query('UPDATE bookings SET booking_status = ? WHERE id = ?', [status, id]);
}

async function deleteItems(conn, id) {
  await conn.query('DELETE FROM booking_items WHERE booking_id = ?', [id]);
}

async function deleteHeader(conn, id) {
  await conn.query('DELETE FROM bookings WHERE id = ?', [id]);
}

async function countPayments(id) {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM booking_payments WHERE booking_id = ?', [id]);
  return rows[0].c;
}
async function sumPaymentsForBooking(conn, bookingId) {
  const [rows] = await conn.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM booking_payments WHERE booking_id = ?',
    [bookingId]
  );
  return Number(rows[0].total);
}

module.exports = {
  getCustomerById,
  getBusinessUnitById,
  getItemsForUpdate,
  getInventoryQuantities,
  insertLedgerEntry,
  adjustInventory,
  insertHeader,
  insertItems,
  findAll,
  count,
  findById,
  findByIdForUpdate,
  findItemsByBookingId,
  updateHeader,
  updateStatus,
  deleteItems,
  deleteHeader,
  countPayments,
  sumPaymentsForBooking
};
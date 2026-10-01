const pool = require('../../config/db');

async function getSaleInvoiceById(id) {
  const [rows] = await pool.query('SELECT id, receipt_no, customer_id FROM sale_invoices WHERE id = ?', [id]);
  return rows[0];
}

async function getBookingById(id) {
  const [rows] = await pool.query('SELECT id, customer_id FROM bookings WHERE id = ?', [id]);
  return rows[0];
}

async function getCustomerById(id) {
  const [rows] = await pool.query('SELECT id, customer_name, mobile_number FROM customers WHERE id = ?', [id]);
  return rows[0];
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE return_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ?',
    params: [`%${search}%`, `%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT * FROM customer_returns ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, status }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (status) {
    extra.push('status = ?');
    params.push(status);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM customer_returns ${whereClause}`, params);
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM customer_returns WHERE id = ?', [id]);
  return rows[0];
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO customer_returns
      (source_type, source_id, source_no, customer_id, customer_name, mobile,
       original_subtotal, original_discount, original_total, refund_amount,
       restocking_fee, final_refund, refund_method, status, cancellation_fee,
       return_reason, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?)`,
    [
      data.source_type,
      data.source_id,
      data.source_no,
      data.customer_id,
      data.customer_name ?? null,
      data.mobile ?? null,
      data.original_subtotal,
      data.original_discount ?? 0,
      data.original_total,
      data.refund_amount,
      data.restocking_fee ?? 0,
      data.final_refund,
      data.refund_method ?? 'cash',
      data.cancellation_fee ?? 0,
      data.return_reason ?? null,
      data.notes ?? null,
    ]
  );
  return result.insertId;
}

async function setReturnNo(id, returnNo) {
  await pool.query('UPDATE customer_returns SET return_no = ? WHERE id = ?', [returnNo, id]);
}

async function updateStatus(id, status) {
  await pool.query('UPDATE customer_returns SET status = ? WHERE id = ?', [status, id]);
}

async function updateNotes(id, notes) {
  await pool.query('UPDATE customer_returns SET notes = ? WHERE id = ?', [notes, id]);
}

async function adjustCustomerBalance(conn, customerId, delta) {
  await conn.query('UPDATE customers SET previous_balance = previous_balance + ? WHERE id = ?', [
    delta,
    customerId,
  ]);
}

module.exports = {
  getSaleInvoiceById,
  getBookingById,
  getCustomerById,
  findAll,
  count,
  findById,
  create,
  setReturnNo,
  updateStatus,
  updateNotes,
  adjustCustomerBalance,
};
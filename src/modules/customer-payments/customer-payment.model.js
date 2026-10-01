const pool = require('../../config/db');

async function getCustomerById(conn, id) {
  const [rows] = await conn.query('SELECT id, previous_balance FROM customers WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function getInvoiceForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, customer_id, (payable - COALESCE((SELECT SUM(total_amount) FROM sale_returns WHERE sale_invoice_id = sale_invoices.id), 0)) AS payable, status FROM sale_invoices WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

// Sum of all payments already recorded against an invoice, optionally
// excluding one payment id (used when recalculating after an edit/delete).
async function sumPaymentsForInvoice(conn, invoiceId, excludePaymentId = null) {
  const params = [invoiceId];
  let query = 'SELECT COALESCE(SUM(amount), 0) AS total FROM customer_payments WHERE invoice_id = ?';
  if (excludePaymentId) {
    query += ' AND id != ?';
    params.push(excludePaymentId);
  }
  const [rows] = await conn.query(query, params);
  return Number(rows[0].total);
}

async function insertPayment(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO customer_payments (invoice_id, customer_id, amount, payment_date, payment_method, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.invoice_id ?? null,
      data.customer_id,
      data.amount,
      data.payment_date,
      data.payment_method,
      data.remarks ?? null,
    ]
  );
  return result.insertId;
}

async function updateInvoiceStatus(conn, invoiceId, status) {
  await conn.query('UPDATE sale_invoices SET status = ? WHERE id = ?', [status, invoiceId]);
}

async function adjustCustomerBalance() { throw new Error("Opening balances are immutable; record a payment or credit instead"); }

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE (c.customer_name LIKE ? OR si.receipt_no LIKE ?)',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search, customerId, invoiceId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (customerId) {
    extra.push('cp.customer_id = ?');
    params.push(customerId);
  }
  if (invoiceId) {
    extra.push('cp.invoice_id = ?');
    params.push(invoiceId);
  }

  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT cp.*, c.customer_name, si.receipt_no
     FROM customer_payments cp
     LEFT JOIN customers c ON c.id = cp.customer_id
     LEFT JOIN sale_invoices si ON si.id = cp.invoice_id
     ${whereClause}
     ORDER BY cp.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, customerId, invoiceId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (customerId) {
    extra.push('cp.customer_id = ?');
    params.push(customerId);
  }
  if (invoiceId) {
    extra.push('cp.invoice_id = ?');
    params.push(invoiceId);
  }

  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM customer_payments cp
     LEFT JOIN customers c ON c.id = cp.customer_id
     LEFT JOIN sale_invoices si ON si.id = cp.invoice_id
     ${whereClause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT cp.*, c.customer_name, si.receipt_no
     FROM customer_payments cp
     LEFT JOIN customers c ON c.id = cp.customer_id
     LEFT JOIN sale_invoices si ON si.id = cp.invoice_id
     WHERE cp.id = ?`,
    [id]
  );
  return rows[0];
}

async function updateMeta(id, data) {
  await pool.query(
    'UPDATE customer_payments SET payment_date = ?, payment_method = ?, remarks = ? WHERE id = ?',
    [data.payment_date, data.payment_method, data.remarks ?? null, id]
  );
}

async function getByIdForUpdate(conn, id) {
  const [rows] = await conn.query('SELECT * FROM customer_payments WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function deleteById(conn, id) {
  await conn.query('DELETE FROM customer_payments WHERE id = ?', [id]);
}

module.exports = {
  getCustomerById,
  getInvoiceForUpdate,
  sumPaymentsForInvoice,
  insertPayment,
  updateInvoiceStatus,
  adjustCustomerBalance,
  findAll,
  count,
  findById,
  updateMeta,
  getByIdForUpdate,
  deleteById,
};

const pool = require('../../config/db');

async function getSupplierById(conn, id) {
  const [rows] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [id]);
  return rows[0];
}

async function getPurchaseForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, supplier_id, payable, payment_status FROM purchases WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

async function sumPaymentsForPurchase(conn, purchaseId, excludePaymentId = null) {
  const params = [purchaseId];
  let query = 'SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_payments WHERE purchase_id = ?';
  if (excludePaymentId) {
    query += ' AND id != ?';
    params.push(excludePaymentId);
  }
  const [rows] = await conn.query(query, params);
  return rows[0].total;
}

async function insertPayment(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_method, payment_date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.supplier_id, data.purchase_id ?? null, data.amount, data.payment_method, data.payment_date, data.note ?? null]
  );
  return result.insertId;
}

async function updatePurchaseStatus(conn, purchaseId, status) {
  await conn.query('UPDATE purchases SET payment_status = ? WHERE id = ?', [status, purchaseId]);
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE s.supplier_name LIKE ? OR p.invoice_no LIKE ?',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search, supplierId, purchaseId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (supplierId) {
    extra.push('sp.supplier_id = ?');
    params.push(supplierId);
  }
  if (purchaseId) {
    extra.push('sp.purchase_id = ?');
    params.push(purchaseId);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT sp.*, s.supplier_name, p.invoice_no
     FROM supplier_payments sp
     JOIN suppliers s ON s.id = sp.supplier_id
     LEFT JOIN purchases p ON p.id = sp.purchase_id
     ${whereClause}
     ORDER BY sp.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search, supplierId, purchaseId }) {
  const { clause, params } = searchWhere(search);
  const extra = [];
  if (supplierId) {
    extra.push('sp.supplier_id = ?');
    params.push(supplierId);
  }
  if (purchaseId) {
    extra.push('sp.purchase_id = ?');
    params.push(purchaseId);
  }
  const where = [clause.replace(/^WHERE /, '')].concat(extra).filter(Boolean);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM supplier_payments sp
     JOIN suppliers s ON s.id = sp.supplier_id
     LEFT JOIN purchases p ON p.id = sp.purchase_id
     ${whereClause}`,
    params
  );
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT sp.*, s.supplier_name, p.invoice_no
     FROM supplier_payments sp
     JOIN suppliers s ON s.id = sp.supplier_id
     LEFT JOIN purchases p ON p.id = sp.purchase_id
     WHERE sp.id = ?`,
    [id]
  );
  return rows[0];
}

async function updateMeta(id, data) {
  await pool.query(
    'UPDATE supplier_payments SET payment_date = ?, payment_method = ?, note = ? WHERE id = ?',
    [data.payment_date, data.payment_method, data.note ?? null, id]
  );
}

async function getByIdForUpdate(conn, id) {
  const [rows] = await conn.query('SELECT * FROM supplier_payments WHERE id = ? FOR UPDATE', [id]);
  return rows[0];
}

async function deleteById(conn, id) {
  await conn.query('DELETE FROM supplier_payments WHERE id = ?', [id]);
}

module.exports = {
  getSupplierById,
  getPurchaseForUpdate,
  sumPaymentsForPurchase,
  insertPayment,
  updatePurchaseStatus,
  findAll,
  count,
  findById,
  updateMeta,
  getByIdForUpdate,
  deleteById,
};

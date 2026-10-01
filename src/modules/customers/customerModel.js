const pool = require('../../config/db');

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return {
    clause: 'WHERE customer_name LIKE ? OR mobile_number LIKE ?',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT
       c.*,
       COALESCE(si.total_sales, 0) AS total_sales,
       COALESCE(sr.total_returns, 0) AS total_sales_returns,
       COALESCE(pay.total_paid, 0) AS total_paid,
       (c.previous_balance
         + COALESCE(si.total_sales, 0)
         - COALESCE(sr.total_returns, 0)
         - COALESCE(pay.total_paid, 0)
       ) AS current_balance,
       si.last_sale_date
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(payable) AS total_sales, MAX(created_at) AS last_sale_date
       FROM sale_invoices GROUP BY customer_id
     ) si ON si.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount) AS total_returns
       FROM sale_returns GROUP BY customer_id
     ) sr ON sr.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount) AS total_paid
       FROM customer_payments GROUP BY customer_id
     ) pay ON pay.customer_id = c.id
     ${clause}
     ORDER BY c.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

const findByIdWithSummary = async (id) => {
  const [rows] = await pool.query(
    `SELECT
       c.*,
       COALESCE(si.total_sales, 0) AS total_sales,
       COALESCE(sr.total_returns, 0) AS total_sales_returns,
       COALESCE(pay.total_paid, 0) AS total_paid,
       (c.previous_balance
         + COALESCE(si.total_sales, 0)
         - COALESCE(sr.total_returns, 0)
         - COALESCE(pay.total_paid, 0)
       ) AS current_balance,
       si.last_sale_date,
       pay.last_payment_date
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(payable) AS total_sales, MAX(created_at) AS last_sale_date
       FROM sale_invoices WHERE customer_id = ? GROUP BY customer_id
     ) si ON si.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount) AS total_returns
       FROM sale_returns WHERE customer_id = ? GROUP BY customer_id
     ) sr ON sr.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount) AS total_paid, MAX(payment_date) AS last_payment_date
       FROM customer_payments WHERE customer_id = ? GROUP BY customer_id
     ) pay ON pay.customer_id = c.id
     WHERE c.id = ?`,
    [id, id, id, id]
  );
  return rows[0] || null;
};

async function count({ search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM customers ${clause}`, params);
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
  return rows[0];
}

async function findByMobile(mobileNumber, excludeId = null) {
  const params = [mobileNumber];
  let query = 'SELECT id FROM customers WHERE mobile_number = ?';
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  return rows[0];
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO customers
      (customer_name, address, mobile_number, payment_method, nearby, previous_balance)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.customer_name,
      data.address ?? null,
      data.mobile_number ?? null,
      data.payment_method ?? null,
      data.nearby ?? null,
      data.previous_balance ?? 0,
    ]
  );
  return result.insertId;
}

async function update(id, data) {
  await pool.query(
    `UPDATE customers
     SET customer_name = ?, address = ?, mobile_number = ?, payment_method = ?, nearby = ?, previous_balance = ?
     WHERE id = ?`,
    [
      data.customer_name,
      data.address ?? null,
      data.mobile_number ?? null,
      data.payment_method ?? null,
      data.nearby ?? null,
      data.previous_balance ?? 0,
      id,
    ]
  );
}

async function remove(id) {
  await pool.query('DELETE FROM customers WHERE id = ?', [id]);
}

// Delete guard: block removal if the customer is referenced anywhere else
async function countReferences(id) {
  const [[a]] = await pool.query('SELECT COUNT(*) AS c FROM sale_invoices WHERE customer_id = ?', [id]);
  const [[b]] = await pool.query('SELECT COUNT(*) AS c FROM customer_payments WHERE customer_id = ?', [id]);
  const [[c]] = await pool.query('SELECT COUNT(*) AS c FROM customer_returns WHERE customer_id = ?', [id]);
  const [[d]] = await pool.query('SELECT COUNT(*) AS c FROM bookings WHERE customer_id = ?', [id]);
  return a.c + b.c + c.c + d.c;
}

module.exports = {
  findAll,
  count,
  findById,
  findByMobile,
  create,
  update,
  remove,
  countReferences,
  findByIdWithSummary
};

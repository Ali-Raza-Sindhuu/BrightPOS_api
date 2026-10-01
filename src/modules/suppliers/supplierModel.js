const pool = require("../../config/db");
const TABLE = "suppliers";

const findAll = async ({ limit, offset, search }) => {
  const params = [];
  let where = "";
  if (search) {
    where = "WHERE s.supplier_name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT
       s.*,
       COALESCE(p.total_purchases, 0) AS total_purchases,
       COALESCE(pr.total_returns, 0) AS total_purchase_returns,
       COALESCE(pay.total_paid, 0) AS total_paid,
       (s.opening_balance
         + COALESCE(p.total_purchases, 0)
         - COALESCE(pr.total_returns, 0)
         - COALESCE(pay.total_paid, 0)
       ) AS current_balance,
       p.last_purchase_date
     FROM ${TABLE} s
     LEFT JOIN (
       SELECT supplier_id, SUM(payable) AS total_purchases, MAX(created_at) AS last_purchase_date
       FROM purchases
       GROUP BY supplier_id
     ) p ON p.supplier_id = s.id
     LEFT JOIN (
       SELECT supplier_id, SUM(total_amount) AS total_returns
       FROM purchase_returns
       GROUP BY supplier_id
     ) pr ON pr.supplier_id = s.id
     LEFT JOIN (
       SELECT supplier_id, SUM(amount) AS total_paid
       FROM supplier_payments
       GROUP BY supplier_id
     ) pay ON pay.supplier_id = s.id
     ${where}
     ORDER BY s.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${TABLE} s ${where}`, params);
  return { rows, total: countRows[0].total };
};

const findById = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  return rows[0] || null;
};

const findByName = async (supplier_name, excludeId = null) => {
  let sql = `SELECT * FROM ${TABLE} WHERE supplier_name = ?`;
  const params = [supplier_name];
  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
};

const ALLOWED_FIELDS = [
  "supplier_name",
  "contact_person",
  "phone",
  "email",
  "address",
  "payment_terms",
  "credit_limit",
  "status",
  "designation",
  "ntn",
  "gst",
  "opening_balance",   // add this
];

const create = async (data) => {
  const cols = [];
  const placeholders = [];
  const values = [];
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) {
      cols.push(key);
      placeholders.push("?");
      values.push(data[key]);
    }
  }
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );
  return findById(result.insertId);
};

const update = async (id, data) => {
  const fields = [];
  const params = [];
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (fields.length === 0) return findById(id);
  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, params);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const countLinkedRecords = async (supplierId) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM item_details WHERE supplier_id = ?) +
       (SELECT COUNT(*) FROM purchases WHERE supplier_id = ?) +
       (SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?) +
       (SELECT COUNT(*) FROM purchase_returns WHERE supplier_id = ?) AS total`,
    [supplierId, supplierId, supplierId, supplierId]
  );
  return rows[0].total;
};

const findByIdWithSummary = async (id) => {
  const [rows] = await pool.query(
    `SELECT
       s.*,
       COALESCE(p.total_purchases, 0) AS total_purchases,
       COALESCE(pr.total_returns, 0) AS total_purchase_returns,
       COALESCE(pay.total_paid, 0) AS total_paid,
       (s.opening_balance
         + COALESCE(p.total_purchases, 0)
         - COALESCE(pr.total_returns, 0)
         - COALESCE(pay.total_paid, 0)
       ) AS current_balance,
       p.last_purchase_date,
       pay.last_payment_date
     FROM ${TABLE} s
     LEFT JOIN (
       SELECT supplier_id, SUM(payable) AS total_purchases, MAX(created_at) AS last_purchase_date
       FROM purchases WHERE supplier_id = ? GROUP BY supplier_id
     ) p ON p.supplier_id = s.id
     LEFT JOIN (
       SELECT supplier_id, SUM(total_amount) AS total_returns
       FROM purchase_returns WHERE supplier_id = ? GROUP BY supplier_id
     ) pr ON pr.supplier_id = s.id
     LEFT JOIN (
       SELECT supplier_id, SUM(amount) AS total_paid, MAX(payment_date) AS last_payment_date
       FROM supplier_payments WHERE supplier_id = ? GROUP BY supplier_id
     ) pay ON pay.supplier_id = s.id
     WHERE s.id = ?`,
    [id, id, id, id]
  );
  return rows[0] || null;
};
module.exports = { findAll, findById, findByName, create, update, remove, countLinkedRecords, findByIdWithSummary };

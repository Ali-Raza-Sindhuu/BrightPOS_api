const pool = require('../../config/db');

async function getHeadById(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, head FROM expense_heads WHERE id = ?',
    [id]
  );
  return rows[0];
}

async function getLastBalance(conn) {
  const [rows] = await conn.query(
    'SELECT balance FROM daybook ORDER BY id DESC LIMIT 1'
  );
  return rows.length ? rows[0].balance : 0;
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };

  return {
    clause: 'WHERE eh.head LIKE ? OR ev.details LIKE ?',
    params: [`%${search}%`, `%${search}%`],
  };
}

async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);

  const [rows] = await pool.query(
    `SELECT ev.*, eh.head
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     ${clause}
     ORDER BY ev.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
}

async function count({ search }) {
  const { clause, params } = searchWhere(search);

  const [rows] = await pool.query(
    `SELECT COUNT(*) total
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     ${clause}`,
    params
  );

  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ev.*, eh.head
     FROM expense_vouchers ev
     LEFT JOIN expense_heads eh ON eh.id = ev.head_id
     WHERE ev.id = ?`,
    [id]
  );

  return rows[0];
}

async function insertVoucher(conn, body) {
  const [result] = await conn.query(
    `INSERT INTO expense_vouchers
    (head_id,amount,details,voucher_date,voucher_number,status,posted_at)
    VALUES (?,?,?,?,?,'posted',UTC_TIMESTAMP())`,
    [
      body.head_id ?? null,
      body.amount,
      body.details ?? null,
      body.voucher_date,
      body.voucher_number,
    ]
  );

  return result.insertId;
}

async function insertDaybook(conn, data) {
  await conn.query(
    `INSERT INTO daybook
    (date,time,reference_type,reference_id,description,cash_out,cash_in,balance,payment_method)
    VALUES (?,?, 'expense', ?, ?, ?,0,?,'cash')`,
    [
      data.date,
      data.time,
      data.reference_id,
      data.description,
      data.cash_out,
      data.balance,
    ]
  );
}

async function updateVoucher(id, body) {
  await pool.query(
    `UPDATE expense_vouchers
     SET head_id=?, amount=?, details=?, voucher_date=?
     WHERE id=?`,
    [
      body.head_id ?? null,
      body.amount,
      body.details ?? null,
      body.voucher_date,
      id,
    ]
  );
}

module.exports = {
  pool,
  getHeadById,
  getLastBalance,
  findAll,
  count,
  findById,
  insertVoucher,
  insertDaybook,
  updateVoucher,
};

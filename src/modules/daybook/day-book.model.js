const pool = require('../../config/db');

async function getLastBalance(conn = pool) {
  const [rows] = await conn.query(
    'SELECT balance FROM daybook ORDER BY id DESC LIMIT 1'
  );
  return rows.length ? rows[0].balance : 0;
}

async function insertEntry(data, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO daybook
    (date,time,reference_type,reference_id,description,cash_out,cash_in,balance,payment_method,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      data.date,
      data.time,
      data.reference_type ?? null,
      data.reference_id ?? null,
      data.description,
      data.cash_out ?? 0,
      data.cash_in ?? 0,
      data.balance,
      data.payment_method ?? 'cash',
      data.created_by ?? null,
    ]
  );

  return result.insertId;
}

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };

  return {
    clause: 'WHERE description LIKE ?',
    params: [`%${search}%`],
  };
}

async function findAll({ limit, offset, search, from, to }) {
  const { clause, params } = searchWhere(search);

  const extra = [];

  if (from) {
    extra.push('date >= ?');
    params.push(from);
  }

  if (to) {
    extra.push('date <= ?');
    params.push(to);
  }

  const where = [clause.replace(/^WHERE /, '')]
    .concat(extra)
    .filter(Boolean);

  const whereClause = where.length
    ? `WHERE ${where.join(' AND ')}`
    : '';

  const [rows] = await pool.query(
    `SELECT * FROM daybook
     ${whereClause}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
}

async function count({ search, from, to }) {
  const { clause, params } = searchWhere(search);

  const extra = [];

  if (from) {
    extra.push('date >= ?');
    params.push(from);
  }

  if (to) {
    extra.push('date <= ?');
    params.push(to);
  }

  const where = [clause.replace(/^WHERE /, '')]
    .concat(extra)
    .filter(Boolean);

  const whereClause = where.length
    ? `WHERE ${where.join(' AND ')}`
    : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) total FROM daybook ${whereClause}`,
    params
  );

  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM daybook WHERE id=?',
    [id]
  );

  return rows[0];
}

module.exports = {
  getLastBalance,
  insertEntry,
  findAll,
  count,
  findById,
};
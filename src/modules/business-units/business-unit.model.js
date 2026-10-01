const pool = require('../../config/db');
const crypto = require('crypto');

const VALID_TYPES = ['Warehouse', 'Shop', 'Godown'];

function searchWhere(search) {
  if (!search) return { clause: '', params: [] };
  return { clause: 'WHERE name LIKE ?', params: [`%${search}%`] };
}

async function findAll({ limit, offset, search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(
    `SELECT * FROM business_units ${clause} ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function count({ search }) {
  const { clause, params } = searchWhere(search);
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM business_units ${clause}`, params);
  return rows[0].total;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM business_units WHERE id = ?', [id]);
  return rows[0];
}

async function findByName(name, excludeId = null) {
  const params = [name];
  let query = 'SELECT id FROM business_units WHERE name = ?';
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  return rows[0];
}

async function create(data) {
  const code = `BU-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const isActive = data.is_active ?? 1;
  const [result] = await pool.query(
    'INSERT INTO business_units (name, code, type, address, is_active, status) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name.trim(), code, data.type ?? 'Warehouse', data.address ?? null, isActive, Number(isActive) ? 'active' : 'inactive']
  );
  return result.insertId;
}

async function update(id, data) {
  const isActive = data.is_active ?? 1;
  await pool.query('UPDATE business_units SET name = ?, type = ?, address = ?, is_active = ?, status = ? WHERE id = ?', [
    data.name.trim(),
    data.type ?? 'Warehouse',
    data.address ?? null,
    isActive,
    Number(isActive) ? 'active' : 'inactive',
    id,
  ]);
}

async function remove(id) {
  await pool.query('DELETE FROM business_units WHERE id = ?', [id]);
}

// Delete guard: block removal if anything now references this location.
async function countReferences(id) {
  const [[a]] = await pool.query('SELECT COUNT(*) AS c FROM inventory WHERE business_unit_id = ?', [id]);
  const [[b]] = await pool.query('SELECT COUNT(*) AS c FROM sale_invoices WHERE business_unit_id = ?', [id]);
  const [[c]] = await pool.query('SELECT COUNT(*) AS c FROM purchases WHERE business_unit_id = ?', [id]);
  const [[d]] = await pool.query(
    'SELECT COUNT(*) AS c FROM stock_transfers WHERE from_unit_id = ? OR to_unit_id = ?',
    [id, id]
  );
  return a.c + b.c + c.c + d.c;
}

module.exports = {
  VALID_TYPES,
  findAll,
  count,
  findById,
  findByName,
  create,
  update,
  remove,
  countReferences,
};
